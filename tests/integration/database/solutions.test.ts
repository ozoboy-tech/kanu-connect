import { randomBytes } from "node:crypto";
import { createPool, type RowDataPacket } from "mysql2/promise";
import { expect, it } from "vitest";

import { registerEmail } from "@/server/auth/accounts";
import {
  createComment, deleteComment,
} from "@/server/comments/comment-repository";
import {
  createPost, deletePost,
} from "@/server/posts/post-repository";
import { getReputation } from
  "@/server/reputation/reputation-repository";
import {
  getSolutionState, setQuestionResolved,
} from "@/server/solutions/solution-repository";
import { setVote } from "@/server/votes/vote-repository";
import { runMigrations } from "../../../scripts/migrate.mjs";

it("sélectionne la solution, transfère le bonus et permet de résoudre", async () => {
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
      "owner", "a", "b", "v1", "v2", "v3", "v4",
    ]) {
      const handle = `sol_${label}_${suffix}`;
      await registerEmail(connection, {
        email: `sol_${label}_${suffix}@example.test`,
        password: "MotDePasse!123456",
        legalName: `Membre ${label}`,
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

    const [owner, firstAuthor, secondAuthor, ...voters] = members;
    const post = await createPost(connection, owner.publicId, {
      kind: "question",
      space: "questions",
      title: "Question avec solutions",
      body: "Quelle réponse est la meilleure ?",
      code: null,
      codeLanguage: null,
      keywords: ["solution"],
    });
    const first = await createComment(
      connection, post.id, firstAuthor.publicId,
      { parentId: null, body: "Première réponse de test" },
    );
    const second = await createComment(
      connection, post.id, secondAuthor.publicId,
      { parentId: null, body: "Seconde réponse de test" },
    );

    expect(await getSolutionState(connection, post.id)).toEqual({
      commentId: null,
      resolved: false,
      votes: 0,
    });

    for (const voter of voters.slice(0, 2)) {
      await setVote(
        connection, "comment", first.id, voter.publicId, true,
      );
    }
    expect(
      (await getSolutionState(connection, post.id))?.commentId,
    ).toBeNull();

    await setVote(
      connection, "comment", first.id, voters[2].publicId, true,
    );
    expect(await getSolutionState(connection, post.id)).toEqual({
      commentId: first.id,
      resolved: false,
      votes: 3,
    });
    expect(
      (await getReputation(connection, firstAuthor.handle))?.points,
    ).toBe(12);

    for (const voter of voters.slice(0, 3)) {
      await setVote(
        connection, "comment", second.id, voter.publicId, true,
      );
    }
    expect(
      (await getSolutionState(connection, post.id))?.commentId,
    ).toBe(first.id);

    await setVote(
      connection, "comment", second.id, voters[3].publicId, true,
    );
    expect(await getSolutionState(connection, post.id)).toEqual({
      commentId: second.id,
      resolved: false,
      votes: 4,
    });
    expect(
      (await getReputation(connection, firstAuthor.handle))?.points,
    ).toBe(2);
    expect(
      (await getReputation(connection, secondAuthor.handle))?.points,
    ).toBe(12);

    expect(
      await setQuestionResolved(
        connection, post.id, firstAuthor.publicId, true,
      ),
    ).toBe("forbidden");
    expect(
      await setQuestionResolved(
        connection, post.id, owner.publicId, true,
      ),
    ).toBe("ok");
    expect(
      (await getSolutionState(connection, post.id))?.resolved,
    ).toBe(true);
    expect(
      await setQuestionResolved(
        connection, post.id, owner.publicId, false,
      ),
    ).toBe("ok");

    await setVote(
      connection, "comment", second.id, voters[3].publicId, false,
    );
    expect(
      (await getSolutionState(connection, post.id))?.commentId,
    ).toBe(first.id);
    expect(
      (await getReputation(connection, firstAuthor.handle))?.points,
    ).toBe(12);
    expect(
      (await getReputation(connection, secondAuthor.handle))?.points,
    ).toBe(2);

    expect(
      await deleteComment(
        connection, post.id, first.id, firstAuthor.publicId,
      ),
    ).toBe("ok");
    expect(
      (await getSolutionState(connection, post.id))?.commentId,
    ).toBe(second.id);

    expect(
      await deletePost(connection, post.id, owner.publicId),
    ).toBe("ok");
    expect(
      await getSolutionState(connection, post.id),
    ).toBeNull();
    expect(
      (await getReputation(connection, secondAuthor.handle))?.points,
    ).toBe(2);
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
