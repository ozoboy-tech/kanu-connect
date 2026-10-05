import { randomBytes } from "node:crypto";
import { createPool, type RowDataPacket } from "mysql2/promise";
import { expect, it } from "vitest";

import { registerEmail } from "@/server/auth/accounts";
import {
  createPost, deletePost, getPost, listPosts, updatePost,
} from "@/server/posts/post-repository";
import { runMigrations } from "../../../scripts/migrate.mjs";

it("publie, filtre, édite 15 minutes et conserve un contenu supprimé", async () => {
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
  let postId: number | undefined;
  try {
    await registerEmail(connection, {
      email: `post_${suffix}@example.test`,
      password: "MotDePasse!123456", legalName: "Awa Test",
      handle: `post_${suffix}`,
    });
    const [members] = await connection.execute<(
      RowDataPacket & { id: number; publicId: string }
    )[]>(
      `SELECT m.id, m.public_id AS publicId FROM members m
       JOIN member_profiles p ON p.member_id = m.id WHERE p.handle = ?`,
      [`post_${suffix}`],
    );
    memberId = members[0].id;
    const authorId = members[0].publicId;
    const input = {
      kind: "question" as const, space: "questions" as const,
      title: "Question de test", body: "Comment faire ?",
      code: "const ok = true;", codeLanguage: "typescript",
      keywords: ["typescript", "aide"],
    };
    const created = await createPost(connection, authorId, input);
    const [posts] = await connection.execute<(RowDataPacket & { id: number })[]>(
      "SELECT id FROM posts WHERE public_id = ?", [created.id],
    );
    postId = posts[0].id;
    expect(created.authorHandle).toBe(`post_${suffix}`);
    expect(created.keywords).toEqual(["aide", "typescript"]);
    expect((await listPosts(connection, "questions")).some((post) => post.id === created.id))
      .toBe(true);
    expect((await listPosts(connection, "projects")).some((post) => post.id === created.id))
      .toBe(false);
    expect(await updatePost(connection, created.id, "autre-membre", input))
      .toBe("forbidden");
    expect(await updatePost(connection, created.id, authorId, {
      ...input, title: "Question corrigée", keywords: ["corrigé"],
    })).toBe("ok");
    expect((await getPost(connection, created.id))?.title).toBe("Question corrigée");
    await connection.execute(
      "UPDATE posts SET created_at = UTC_TIMESTAMP(3) - INTERVAL 16 MINUTE WHERE id = ?",
      [postId],
    );
    expect(await updatePost(connection, created.id, authorId, input)).toBe("forbidden");
    expect(await deletePost(connection, created.id, authorId)).toBe("forbidden");
    await connection.execute(
      "UPDATE posts SET created_at = UTC_TIMESTAMP(3) WHERE id = ?", [postId],
    );
    expect(await deletePost(connection, created.id, authorId)).toBe("ok");
    expect(await getPost(connection, created.id)).toMatchObject({
      title: "Contenu supprimé", body: null, authorHandle: null, deleted: true,
    });
    expect((await listPosts(connection, null)).some((post) => post.id === created.id))
      .toBe(false);
  } finally {
    try {
      if (postId) {
        await connection.execute("DELETE FROM post_keywords WHERE post_id = ?", [postId]);
        await connection.execute("DELETE FROM posts WHERE id = ?", [postId]);
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
