import { randomBytes } from "node:crypto";
import { createPool, type RowDataPacket } from "mysql2/promise";
import { expect, it } from "vitest";

import { registerEmail } from "@/server/auth/accounts";
import { createComment } from "@/server/comments/comment-repository";
import { createPost, deletePost } from "@/server/posts/post-repository";
import { createProject } from "@/server/projects/project-repository";
import {
  getReputation, listLeaderboard,
} from "@/server/reputation/reputation-repository";
import { getPublicStreak } from "@/server/streaks/streak-repository";
import {
  getVoteState, setVote,
} from "@/server/votes/vote-repository";
import { runMigrations } from "../../../scripts/migrate.mjs";

it("vote une fois par contenu, interdit l'auto-vote et départage le classement", async () => {
  const password = process.env.KANU_TEST_DB_PASSWORD;
  const migrationPassword = process.env.KANU_MIGRATE_TEST_DB_PASSWORD;
  if (!password || !migrationPassword) {
    throw new Error("Mots de passe MySQL de test absents.");
  }
  await runMigrations("test", migrationPassword);
  const pool = createPool({
    host: "127.0.0.1", port: 3306,
    user: "kanu_app_test", password,
    database: "kanuconnecttest",
    charset: "utf8mb4", timezone: "Z",
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
    for (const label of ["aa", "zz", "vv"]) {
      const handle = `vote_${label}_${suffix}`;
      await registerEmail(connection, {
        email: `vote_${label}_${suffix}@example.test`,
        password: "MotDePasse!123456",
        legalName: `Test ${label}`,
        handle,
      });
      const [rows] = await connection.execute<(
        RowDataPacket & { id: number; publicId: string }
      )[]>(
        `SELECT m.id, m.public_id AS publicId
         FROM members m
         JOIN member_profiles p ON p.member_id = m.id
         WHERE p.handle = ?`,
        [handle],
      );
      members.push({ ...rows[0], handle });
    }

    const [alphabetical, popular, voter] = members;

    async function publish(authorId: string, title: string) {
      return createPost(connection, authorId, {
        kind: "question", space: "questions", title,
        body: "Question pour le test",
        code: null, codeLanguage: null,
        keywords: ["test"],
      });
    }

    const otherPost = await publish(
      alphabetical.publicId, "Question A",
    );
    const post = await publish(
      popular.publicId, "Question Z",
    );

    async function project(authorId: string, title: string) {
      return createProject(connection, authorId, {
        title,
        summary: "Résumé de test",
        description: "Détails de test",
        status: "building",
        technologies: ["TypeScript"],
        repositoryUrl: null,
        demoUrl: null,
      });
    }

    await project(alphabetical.publicId, "Projet A");
    const featured = await project(
      popular.publicId, "Projet Z",
    );
    const comment = await createComment(
      connection, post.id, popular.publicId,
      { parentId: null, body: "Réponse de test" },
    );
    await createComment(
      connection, otherPost.id, alphabetical.publicId,
      { parentId: null, body: "Réponse de test" },
    );

    expect(
      (await getReputation(connection, popular.handle))?.points,
    ).toBe(15);
    expect(
      (await getReputation(connection, alphabetical.handle))?.points,
    ).toBe(15);

    expect(
      await setVote(
        connection, "post", post.id, popular.publicId, true,
      ),
    ).toBe("self");
    expect(
      await setVote(
        connection, "comment", comment.id, popular.publicId, true,
      ),
    ).toBe("self");
    expect(
      await setVote(
        connection, "project", featured.id, popular.publicId, true,
      ),
    ).toBe("self");

    expect(
      await setVote(
        connection, "post", post.id, voter.publicId, true,
      ),
    ).toEqual({ count: 1, voted: true });
    expect(
      await setVote(
        connection, "post", post.id, voter.publicId, true,
      ),
    ).toEqual({ count: 1, voted: true });
    expect(
      await setVote(
        connection, "comment", comment.id, voter.publicId, true,
      ),
    ).toEqual({ count: 1, voted: true });
    expect(
      await setVote(
        connection, "project", featured.id, voter.publicId, true,
      ),
    ).toEqual({ count: 1, voted: true });

    expect(
      (await getReputation(connection, voter.handle))?.points,
    ).toBe(3);
    expect(
      (await getPublicStreak(connection, voter.handle))?.currentDays,
    ).toBe(1);
    expect(
      (await getReputation(connection, popular.handle))?.points,
    ).toBe(15);

    expect(
      await setVote(
        connection, "post", post.id, voter.publicId, false,
      ),
    ).toEqual({ count: 0, voted: false });
    expect(
      await setVote(
        connection, "post", post.id, voter.publicId, true,
      ),
    ).toEqual({ count: 1, voted: true });
    expect(
      (await getReputation(connection, voter.handle))?.points,
    ).toBe(3);

    for (const period of ["all", "week"] as const) {
      const ranking = await listLeaderboard(connection, period);
      expect(
        ranking.find(
          (member) => member.handle === popular.handle,
        )?.votes,
      ).toBe(3);
      expect(
        ranking.findIndex(
          (member) => member.handle === popular.handle,
        ),
      ).toBeLessThan(
        ranking.findIndex(
          (member) => member.handle === alphabetical.handle,
        ),
      );
    }

    expect(
      await deletePost(connection, post.id, popular.publicId),
    ).toBe("ok");
    expect(
      await getVoteState(
        connection, "post", post.id, voter.publicId,
      ),
    ).toBeNull();
    expect(
      await getVoteState(
        connection, "comment", comment.id, voter.publicId,
      ),
    ).toBeNull();
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
}, 90_000);
