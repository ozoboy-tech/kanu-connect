import { randomBytes } from "node:crypto";
import { createPool, type RowDataPacket } from "mysql2/promise";
import { expect, it } from "vitest";

import { registerEmail } from "@/server/auth/accounts";
import {
  createComment, deleteComment, getComment, listComments, updateComment,
} from "@/server/comments/comment-repository";
import { createPost, deletePost } from "@/server/posts/post-repository";
import { runMigrations } from "../../../scripts/migrate.mjs";

it("garde les réponses après suppression et impose auteur, délai et profondeur", async () => {
  const appPassword = process.env.KANU_TEST_DB_PASSWORD;
  const migrationPassword = process.env.KANU_MIGRATE_TEST_DB_PASSWORD;
  if (!appPassword || !migrationPassword) throw new Error("Mots de passe MySQL de test absents.");
  await runMigrations("test", migrationPassword);
  const pool = createPool({
    host: "127.0.0.1", port: 3306, user: "kanu_app_test",
    password: appPassword, database: "kanuconnecttest", charset: "utf8mb4",
    timezone: "Z", multipleStatements: false,
  });
  const connection = await pool.getConnection();
  const suffix = randomBytes(8).toString("hex");
  let memberId: number | undefined;
  let postInternalId: number | undefined;
  try {
    await registerEmail(connection, {
      email: `comments_${suffix}@example.test`,
      password: "MotDePasse!123456", legalName: "Awa Test",
      handle: `c_${suffix}`,
    });
    const [members] = await connection.execute<(
      RowDataPacket & { id: number; publicId: string }
    )[]>(
      `SELECT m.id, m.public_id AS publicId FROM members m
       JOIN member_profiles p ON p.member_id = m.id WHERE p.handle = ?`,
      [`c_${suffix}`],
    );
    memberId = members[0].id;
    const authorId = members[0].publicId;
    const post = await createPost(connection, authorId, {
      kind: "question", space: "questions", title: "Question test",
      body: "Un problème", code: null, codeLanguage: null,
      keywords: ["aide"],
    });
    const [posts] = await connection.execute<(RowDataPacket & { id: number })[]>(
      "SELECT id FROM posts WHERE public_id = ?", [post.id],
    );
    postInternalId = posts[0].id;

    const root = await createComment(connection, post.id, authorId, {
      body: "Première réponse", parentId: null,
    });
    const reply = await createComment(connection, post.id, authorId, {
      body: "Suite du fil", parentId: root.id,
    });
    expect(reply).toMatchObject({ parentId: root.id, depth: 1 });
    expect(await updateComment(connection, post.id, reply.id, "autre", "Intrusion"))
      .toBe("forbidden");
    expect(await updateComment(connection, post.id, reply.id, authorId, "Texte corrigé"))
      .toBe("ok");
    expect((await getComment(connection, reply.id))?.body).toBe("Texte corrigé");

    await connection.execute(
      `UPDATE post_comments SET created_at = UTC_TIMESTAMP(3) - INTERVAL 16 MINUTE
       WHERE public_id = ?`, [reply.id],
    );
    expect(await deleteComment(connection, post.id, reply.id, authorId))
      .toBe("forbidden");
    expect(await deleteComment(connection, post.id, root.id, authorId)).toBe("ok");
    expect(await getComment(connection, root.id)).toMatchObject({
      body: "Contenu supprimé", authorHandle: null, deleted: true,
    });
    expect((await listComments(connection, post.id)).find((item) => item.id === reply.id)
      ?.parentId).toBe(root.id);

    let parent = reply;
    for (let depth = 2; depth <= 4; depth += 1) {
      parent = await createComment(connection, post.id, authorId, {
        body: `Niveau ${depth}`, parentId: parent.id,
      });
      expect(parent.depth).toBe(depth);
    }
    await expect(createComment(connection, post.id, authorId, {
      body: "Trop profond", parentId: parent.id,
    })).rejects.toThrow(/impossible/);
    expect(await deletePost(connection, post.id, authorId)).toBe("ok");
    await expect(createComment(connection, post.id, authorId, {
      body: "Trop tard", parentId: null,
    })).rejects.toThrow(/indisponible/);
    expect((await listComments(connection, post.id)).length).toBe(5);
  } finally {
    try {
      if (postInternalId) {
        for (let depth = 4; depth >= 0; depth -= 1) {
          await connection.execute(
            "DELETE FROM post_comments WHERE post_id = ? AND depth = ?",
            [postInternalId, depth],
          );
        }
        await connection.execute("DELETE FROM post_keywords WHERE post_id = ?", [postInternalId]);
        await connection.execute("DELETE FROM posts WHERE id = ?", [postInternalId]);
      }
      if (memberId) {
        for (const table of [
          "member_auth_tokens", "member_sessions", "member_oauth_link_intents",
          "member_oauth_accounts", "member_email_credentials", "member_profiles",
          "member_private_identities",
        ]) await connection.query(`DELETE FROM ${table} WHERE member_id = ?`, [memberId]);
        await connection.execute("DELETE FROM members WHERE id = ?", [memberId]);
      }
    } finally { connection.release(); await pool.end(); }
  }
}, 90_000);
