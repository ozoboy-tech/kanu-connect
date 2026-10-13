import { randomBytes, randomUUID } from "node:crypto";
import { createPool, type ResultSetHeader, type RowDataPacket } from "mysql2/promise";
import { expect, it } from "vitest";
import { authenticateEmail, consumeEmailToken, registerEmail } from "@/server/auth/accounts";
import { deactivateAccount, deleteAccount, getAccount } from "@/server/accounts/account-repository";
import { startSession, touchSession } from "@/server/auth/session-store";
import { blockState, listMyBlocks, setBlock } from "@/server/members/block-repository";
import { getFollowStats, setFollow } from "@/server/members/follow-repository";
import { getPublicProfile } from "@/server/members/profile-repository";
import { getPost } from "@/server/posts/post-repository";
import { listComments } from "@/server/comments/comment-repository";
import { runMigrations } from "../../../scripts/migrate.mjs";

it("bloque les interactions, réactive et supprime un compte sans conserver ses identifiants", async () => {
  const password = process.env.KANU_TEST_DB_PASSWORD;
  const migrationPassword = process.env.KANU_MIGRATE_TEST_DB_PASSWORD;
  if (!password || !migrationPassword) throw new Error("Mots de passe MySQL absents.");
  await runMigrations("test", migrationPassword);
  const pool = createPool({ host: "127.0.0.1", port: 3306, user: "kanu_app_test",
    password, database: "kanuconnecttest", charset: "utf8mb4", timezone: "Z",
    multipleStatements: false });
  const db = await pool.getConnection();
  const suffix = randomBytes(6).toString("hex");
  const members: { id: number; publicId: string; email: string; handle: string }[] = [];
  let postId: number | null = null;
  try {
    for (const label of ["a", "b"]) {
      const email = `lot330_${label}_${suffix}@example.test`;
      const handle = `lot330_${label}_${suffix}`;
      const registration = await registerEmail(db, { email, handle,
        password: "MotDePasse!123456", legalName: `Test ${label}` });
      expect(await consumeEmailToken(db, registration.token, "verify")).toBe(true);
      const publicId = await authenticateEmail(db, email, "MotDePasse!123456");
      expect(publicId).toBeTruthy();
      const [rows] = await db.execute<(RowDataPacket & { id: number })[]>(
        "SELECT id FROM members WHERE public_id = ?", [publicId],
      );
      members.push({ id: rows[0].id, publicId: publicId!, email, handle });
    }
    const [first, second] = members;
    expect(await setFollow(db, second.handle, first.publicId, true)).toBe("ok");
    expect(await setBlock(db, first.publicId, second.handle, true)).toBe("ok");
    expect(await setBlock(db, first.publicId, second.handle, true)).toBe("ok");
    expect(await blockState(db, first.publicId, second.handle)).toMatchObject({ blockedByMe: true });
    expect(await listMyBlocks(db, first.publicId)).toEqual([second.handle]);
    expect(await getPublicProfile(db, second.handle, first.publicId)).toBeNull();
    expect(await getFollowStats(db, second.handle, first.publicId)).toBeNull();
    expect(await setFollow(db, second.handle, first.publicId, true)).toBe("blocked");
    expect(await setFollow(db, first.handle, second.publicId, true)).toBe("blocked");
    expect(await setBlock(db, first.publicId, second.handle, false)).toBe("ok");
    expect(await getPublicProfile(db, second.handle, first.publicId)).not.toBeNull();

    const postPublicId = randomUUID();
    const [post] = await db.execute<ResultSetHeader>(
      `INSERT INTO posts (public_id, member_id, kind, space, title, body,
        created_at, updated_at) VALUES (?, ?, 'question', 'questions',
        'Titre privé', 'Corps privé', UTC_TIMESTAMP(3), UTC_TIMESTAMP(3))`,
      [postPublicId, second.id],
    );
    postId = post.insertId;
    await db.execute(`INSERT INTO post_comments
      (public_id, post_id, member_id, depth, body, created_at, updated_at)
      VALUES (?, ?, ?, 0, 'Réponse conservée', UTC_TIMESTAMP(3), UTC_TIMESTAMP(3))`,
    [randomUUID(), postId, first.id]);

    const secret = await startSession(db, second.publicId);
    expect(await deactivateAccount(db, second.publicId)).toBe("ok");
    expect(await touchSession(db, secret)).toBeNull();
    expect(await authenticateEmail(db, second.email, "faux mot de passe")).toBeNull();
    expect((await getAccount(db, second.publicId))?.status).toBe("deactivated");
    expect(await authenticateEmail(db, second.email, "MotDePasse!123456")).toBe(second.publicId);
    expect((await getAccount(db, second.publicId))?.status).toBe("active");
    expect(await deleteAccount(db, second.publicId, null, "SUPPRIMER MON COMPTE"))
      .toBe("forbidden");
    expect(await deleteAccount(db, second.publicId, "MotDePasse!123456",
      "SUPPRIMER MON COMPTE")).toBe("ok");
    expect((await getAccount(db, second.publicId))?.status).toBe("deleted");
    expect(await authenticateEmail(db, second.email, "MotDePasse!123456")).toBeNull();
    expect(await getPublicProfile(db, second.handle)).toBeNull();
    expect(await getPost(db, postPublicId)).toMatchObject({ deleted: true,
      authorId: null, body: null });
    expect((await listComments(db, postPublicId)).map((comment) => comment.body))
      .toEqual(["Réponse conservée"]);
  } finally {
    try {
      await db.rollback();
      if (postId) {
        await db.execute("DELETE FROM post_comments WHERE post_id = ?", [postId]);
        await db.execute("DELETE FROM posts WHERE id = ?", [postId]);
      }
      for (const member of members) {
        await db.execute("DELETE FROM member_follows WHERE follower_id = ? OR followed_id = ?",
          [member.id, member.id]);
        for (const table of ["member_sessions", "member_auth_tokens", "member_email_credentials",
          "member_profiles", "member_private_identities"]) {
          await db.query(`DELETE FROM ${table} WHERE member_id = ?`, [member.id]);
        }
        await db.execute("DELETE FROM members WHERE id = ?", [member.id]);
      }
    } finally { db.release(); await pool.end(); }
  }
}, 90_000);
