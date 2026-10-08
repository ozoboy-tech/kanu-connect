import { randomBytes } from "node:crypto";
import {
  createPool,
  type RowDataPacket,
} from "mysql2/promise";
import { expect, it } from "vitest";

import { registerEmail } from
  "@/server/auth/accounts";
import { createComment } from
  "@/server/comments/comment-repository";
import {
  listModerationQueue,
  reviewContent,
} from "@/server/moderation/moderation-repository";
import {
  createPost,
  getPost,
} from "@/server/posts/post-repository";
import {
  createProject,
  getProject,
} from "@/server/projects/project-repository";
import { getReputation } from
  "@/server/reputation/reputation-repository";
import { reportContent } from
  "@/server/reports/report-repository";
import { getSolutionState } from
  "@/server/solutions/solution-repository";
import { setVote } from
  "@/server/votes/vote-repository";
import { runMigrations } from
  "../../../scripts/migrate.mjs";

it(
  "révise les trois contenus et protège la décision du modérateur",
  async () => {
    const password =
      process.env.KANU_TEST_DB_PASSWORD;
    const migrationPassword =
      process.env.KANU_MIGRATE_TEST_DB_PASSWORD;

    if (!password || !migrationPassword) {
      throw new Error(
        "Mots de passe MySQL absents.",
      );
    }

    await runMigrations(
      "test",
      migrationPassword,
    );

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

    const connection =
      await pool.getConnection();
    const previousModerators =
      process.env.KANU_MODERATOR_IDS;
    const suffix =
      randomBytes(8).toString("hex");

    const members: {
      id: number;
      publicId: string;
      handle: string;
    }[] = [];

    try {
      for (const label of [
        "owner",
        "mod",
        "other",
        "third",
      ]) {
        const handle = `mod_${label}_${suffix}`;

        await registerEmail(connection, {
          email: `${handle}@example.test`,
          password: "MotDePasse!123456",
          legalName: `Test ${label}`,
          handle,
        });

        const [rows] =
          await connection.execute<(
            RowDataPacket & {
              id: number;
              publicId: string;
            }
          )[]>(
            `SELECT m.id,
                    m.public_id AS publicId
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

      const [
        owner,
        moderator,
        other,
        third,
      ] = members;

      process.env.KANU_MODERATOR_IDS =
        moderator.publicId;

      const post = await createPost(
        connection,
        owner.publicId,
        {
          kind: "question",
          space: "questions",
          title: "Question à modérer",
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
          body: "Réponse à modérer",
        },
      );

      const project = await createProject(
        connection,
        owner.publicId,
        {
          title: "Projet à modérer",
          summary: "Résumé de test",
          description: "Description de test",
          status: "building",
          technologies: ["TypeScript"],
          repositoryUrl: null,
          demoUrl: null,
        },
      );

      for (const voter of [
        moderator,
        other,
        third,
      ]) {
        await setVote(
          connection,
          "comment",
          comment.id,
          voter.publicId,
          true,
        );
      }

      expect(
        (await getSolutionState(
          connection,
          post.id,
        ))?.commentId,
      ).toBe(comment.id);

      expect(
        (await getReputation(
          connection,
          owner.handle,
        ))?.points,
      ).toBe(25);

      expect(
        await reviewContent(
          connection,
          "project",
          project.id,
          moderator.publicId,
          "hide",
          "Sans signalement",
        ),
      ).toBe("not_found");

      for (const kind of [
        "post",
        "comment",
        "project",
      ] as const) {
        const id = {
          post: post.id,
          comment: comment.id,
          project: project.id,
        }[kind];

        expect(
          await reportContent(
            connection,
            kind,
            id,
            other.publicId,
            "spam",
          ),
        ).toEqual({
          reported: true,
          hidden: false,
        });
      }

      expect(
        await reviewContent(
          connection,
          "comment",
          comment.id,
          other.publicId,
          "hide",
          "Sans droit",
        ),
      ).toBe("forbidden");

      await expect(
        listModerationQueue(
          connection,
          other.publicId,
        ),
      ).rejects.toThrow("Accès refusé.");

      expect(
        await reviewContent(
          connection,
          "comment",
          comment.id,
          moderator.publicId,
          "hide",
          "Spam vérifié",
        ),
      ).toBe("ok");

      expect(
        (await getSolutionState(
          connection,
          post.id,
        ))?.commentId,
      ).toBeNull();

      expect(
        (await getReputation(
          connection,
          owner.handle,
        ))?.points,
      ).toBe(15);

      expect(
        await reviewContent(
          connection,
          "comment",
          comment.id,
          moderator.publicId,
          "restore",
          "Erreur",
        ),
      ).toBe("ok");

      expect(
        (await getSolutionState(
          connection,
          post.id,
        ))?.commentId,
      ).toBe(comment.id);

      expect(
        (await getReputation(
          connection,
          owner.handle,
        ))?.points,
      ).toBe(25);

      expect(
        await reviewContent(
          connection,
          "project",
          project.id,
          moderator.publicId,
          "hide",
          "À vérifier",
        ),
      ).toBe("ok");

      expect(
        await getProject(
          connection,
          project.id,
        ),
      ).toBeNull();

      expect(
        await reviewContent(
          connection,
          "project",
          project.id,
          moderator.publicId,
          "restore",
          "Conforme",
        ),
      ).toBe("ok");

      expect(
        await getProject(
          connection,
          project.id,
        ),
      ).not.toBeNull();

      for (const reporter of [
        moderator,
        third,
      ]) {
        await reportContent(
          connection,
          "post",
          post.id,
          reporter.publicId,
          "spam",
        );
      }

      expect(
        await getPost(
          connection,
          post.id,
        ),
      ).toBeNull();

      expect(
        await reviewContent(
          connection,
          "post",
          post.id,
          moderator.publicId,
          "restore",
          "Conforme",
        ),
      ).toBe("ok");

      expect(
        await getPost(
          connection,
          post.id,
        ),
      ).not.toBeNull();

      expect(
        (await getSolutionState(
          connection,
          post.id,
        ))?.commentId,
      ).toBe(comment.id);

      const queue =
        await listModerationQueue(
          connection,
          moderator.publicId,
        );

      expect(
        queue.find(
          (item) => item.id === post.id,
        ),
      ).toMatchObject({
        kind: "post",
        count: 3,
        decision: "restore",
        hidden: false,
      });

      expect(
        queue.find(
          (item) => item.id === comment.id,
        ),
      ).toMatchObject({
        kind: "comment",
        decision: "restore",
        hidden: false,
      });

      expect(
        queue.find(
          (item) => item.id === project.id,
        ),
      ).toMatchObject({
        kind: "project",
        decision: "restore",
        hidden: false,
      });
    } finally {
      try {
        for (const member of members) {
          await connection.execute(
            `DELETE FROM post_comments
             WHERE member_id = ?`,
            [member.id],
          );
        }

        for (const member of members) {
          await connection.execute(
            `DELETE FROM post_keywords
             WHERE post_id IN (
               SELECT id
               FROM posts
               WHERE member_id = ?
             )`,
            [member.id],
          );

          await connection.execute(
            "DELETE FROM posts WHERE member_id = ?",
            [member.id],
          );

          await connection.execute(
            `DELETE FROM member_projects
             WHERE member_id = ?`,
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
              `DELETE FROM ${table}
               WHERE member_id = ?`,
              [member.id],
            );
          }

          await connection.execute(
            "DELETE FROM members WHERE id = ?",
            [member.id],
          );
        }
      } finally {
        if (
          previousModerators === undefined
        ) {
          delete process.env
            .KANU_MODERATOR_IDS;
        } else {
          process.env.KANU_MODERATOR_IDS =
            previousModerators;
        }

        connection.release();
        await pool.end();
      }
    }
  },
  90_000,
);
