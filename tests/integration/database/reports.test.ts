import { randomBytes } from "node:crypto";
import { createPool, type RowDataPacket } from "mysql2/promise";
import { expect, it } from "vitest";

import { registerEmail } from "@/server/auth/accounts";
import {
  createComment,
  listComments,
} from "@/server/comments/comment-repository";
import {
  createPost,
  getPost,
  listPosts,
} from "@/server/posts/post-repository";
import {
  createProject,
  getProject,
  listProjects,
} from "@/server/projects/project-repository";
import { getReputation } from
  "@/server/reputation/reputation-repository";
import {
  getReportState,
  reportContent,
} from "@/server/reports/report-repository";
import { getSolutionState } from
  "@/server/solutions/solution-repository";
import {
  getVoteState,
  setVote,
} from "@/server/votes/vote-repository";
import { runMigrations } from "../../../scripts/migrate.mjs";

it(
  "masque après trois signalements distincts et retire une solution masquée",
  async () => {
    const password = process.env.KANU_TEST_DB_PASSWORD;
    const migrationPassword =
      process.env.KANU_MIGRATE_TEST_DB_PASSWORD;

    if (!password || !migrationPassword) {
      throw new Error("Mots de passe MySQL de test absents.");
    }

    await runMigrations("test", migrationPassword);

    const pool = createPool({
      host: "127.0.0.1",
      port: 3306,
      user: "kanu_app_test",
      password,
      database: "kanuconnecttest",
      charset: "utf8mb4",
      timezone: "Z",
      multipleStatements: false,
    });

    const connection = await pool.getConnection();
    const suffix = randomBytes(8).toString("hex");
    const members: {
      id: number;
      publicId: string;
      handle: string;
    }[] = [];

    try {
      for (const label of [
        "owner",
        "one",
        "two",
        "three",
      ]) {
        const handle = `report_${label}_${suffix}`;

        await registerEmail(connection, {
          email: `${handle}@example.test`,
          password: "MotDePasse!123456",
          legalName: `Test ${label}`,
          handle,
        });

        const [rows] = await connection.execute<(
          RowDataPacket & {
            id: number;
            publicId: string;
          }
        )[]>(
          `SELECT m.id, m.public_id AS publicId
           FROM members m
           JOIN member_profiles p
             ON p.member_id = m.id
           WHERE p.handle = ?`,
          [handle],
        );

        members.push({
          ...rows[0],
          handle,
        });
      }

      const [owner, ...reporters] = members;

      const post = await createPost(
        connection,
        owner.publicId,
        {
          kind: "question",
          space: "questions",
          title: "Question signalée",
          body: "Question pour le test",
          code: null,
          codeLanguage: null,
          keywords: ["test"],
        },
      );

      const comment = await createComment(
        connection,
        post.id,
        owner.publicId,
        {
          parentId: null,
          body: "Réponse pour le test",
        },
      );

      const project = await createProject(
        connection,
        owner.publicId,
        {
          title: "Projet signalé",
          summary: "Résumé pour le test",
          description: "Description pour le test",
          status: "building",
          technologies: ["TypeScript"],
          repositoryUrl: null,
          demoUrl: null,
        },
      );

      expect(
        await reportContent(
          connection,
          "post",
          post.id,
          owner.publicId,
          "spam",
        ),
      ).toBe("self");

      expect(
        await reportContent(
          connection,
          "post",
          "00000000-0000-0000-0000-000000000000",
          reporters[0].publicId,
          "spam",
        ),
      ).toBe("not_found");

      for (const reporter of reporters) {
        await setVote(
          connection,
          "comment",
          comment.id,
          reporter.publicId,
          true,
        );
      }

      expect(
        (await getSolutionState(connection, post.id))
          ?.commentId,
      ).toBe(comment.id);

      expect(
        (await getReputation(connection, owner.handle))
          ?.points,
      ).toBe(25);

      for (const kind of [
        "comment",
        "project",
        "post",
      ] as const) {
        const id = {
          comment: comment.id,
          project: project.id,
          post: post.id,
        }[kind];

        expect(
          await reportContent(
            connection,
            kind,
            id,
            reporters[0].publicId,
            "spam",
          ),
        ).toEqual({
          reported: true,
          hidden: false,
        });

        // Un deuxième appel du même membre ne compte pas.
        expect(
          await reportContent(
            connection,
            kind,
            id,
            reporters[0].publicId,
            "harassment",
          ),
        ).toEqual({
          reported: true,
          hidden: false,
        });

        expect(
          await reportContent(
            connection,
            kind,
            id,
            reporters[1].publicId,
            "spam",
          ),
        ).toEqual({
          reported: true,
          hidden: false,
        });

        expect(
          await reportContent(
            connection,
            kind,
            id,
            reporters[2].publicId,
            "inappropriate",
          ),
        ).toEqual({
          reported: true,
          hidden: true,
        });

        expect(
          await getReportState(
            connection,
            kind,
            id,
            reporters[0].publicId,
          ),
        ).toBeNull();
      }

      expect(
        (await listComments(connection, post.id))[0],
      ).toMatchObject({
        deleted: true,
        authorId: null,
        body: "Contenu masqué après signalements",
      });

      expect(
        await getVoteState(
          connection,
          "comment",
          comment.id,
          reporters[0].publicId,
        ),
      ).toBeNull();

      expect(
        (await getReputation(connection, owner.handle))
          ?.points,
      ).toBe(15);

      expect(
        await getSolutionState(connection, post.id),
      ).toBeNull();

      expect(
        await getPost(connection, post.id),
      ).toBeNull();

      expect(
        (await listPosts(connection, null))
          .some((item) => item.id === post.id),
      ).toBe(false);

      expect(
        await getProject(connection, project.id),
      ).toBeNull();

      expect(
        (await listProjects(connection))
          .some((item) => item.id === project.id),
      ).toBe(false);
    } finally {
      try {
        for (const member of members) {
          await connection.execute(
            "DELETE FROM post_comments WHERE member_id = ?",
            [member.id],
          );
        }

        for (const member of members) {
          await connection.execute(
            `DELETE FROM post_keywords
             WHERE post_id IN (
               SELECT id FROM posts WHERE member_id = ?
             )`,
            [member.id],
          );

          await connection.execute(
            "DELETE FROM posts WHERE member_id = ?",
            [member.id],
          );

          await connection.execute(
            "DELETE FROM member_projects WHERE member_id = ?",
            [member.id],
          );

          for (const table of [
            "member_auth_tokens",
            "member_sessions",
            "member_oauth_link_intents",
            "member_oauth_accounts",
            "member_email_credentials",
            "member_profiles",
            "member_private_identities",
          ]) {
            await connection.query(
              `DELETE FROM ${table} WHERE member_id = ?`,
              [member.id],
            );
          }

          await connection.execute(
            "DELETE FROM members WHERE id = ?",
            [member.id],
          );
        }
      } finally {
        connection.release();
        await pool.end();
      }
    }
  },
  90_000,
);
