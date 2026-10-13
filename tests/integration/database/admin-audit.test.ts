import { randomBytes, randomUUID } from "node:crypto";
import { createPool, type ResultSetHeader, type RowDataPacket } from "mysql2/promise";
import { expect, it } from "vitest";
import { administerAccount, listAdminMembers, parseAdminAction } from
  "@/server/accounts/admin-repository";
import { startSession, touchSession } from "@/server/auth/session-store";
import { reviewContent } from "@/server/moderation/moderation-repository";
import { canModerate, isAdmin } from "@/server/moderation/moderator";
import { getPost } from "@/server/posts/post-repository";
import { runMigrations } from "../../../scripts/migrate.mjs";

it("réserve les rôles à l'admin et conserve un audit de chaque décision motivée", async () => {
  const password = process.env.KANU_TEST_DB_PASSWORD;
  const migrationPassword = process.env.KANU_MIGRATE_TEST_DB_PASSWORD;
  if (!password || !migrationPassword) throw new Error("Mots de passe MySQL absents.");
  await runMigrations("test", migrationPassword);
  const pool = createPool({ host: "127.0.0.1", port: 3306, user: "kanu_app_test",
    password, database: "kanuconnecttest", charset: "utf8mb4", timezone: "Z",
    multipleStatements: false });
  const db = await pool.getConnection();
  const previous = process.env.KANU_ADMIN_IDS;
  const suffix = randomBytes(6).toString("hex");
  const members: { id: number; publicId: string }[] = [];
  let postId: number | null = null;
  try {
    for (const label of ["admin", "mod", "owner"]) {
      const publicId = randomUUID();
      const [insert] = await db.execute<ResultSetHeader>(
        `INSERT INTO members (public_id, created_at, updated_at)
         VALUES (?, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3))`, [publicId],
      );
      members.push({ id: insert.insertId, publicId });
      await db.execute(`INSERT INTO member_profiles
        (member_id, handle, created_at, updated_at)
        VALUES (?, ?, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3))`,
      [insert.insertId, `lot330_${label}_${suffix}`]);
    }
    const [admin, moderator, owner] = members;
    process.env.KANU_ADMIN_IDS = admin.publicId;
    const publicPostId = randomUUID();
    const [post] = await db.execute<ResultSetHeader>(
      `INSERT INTO posts (public_id, member_id, kind, space, title, body,
         created_at, updated_at)
       VALUES (?, ?, 'tip', 'sharing', 'Test', 'Test', UTC_TIMESTAMP(3), UTC_TIMESTAMP(3))`,
      [publicPostId, owner.id],
    );
    postId = post.insertId;
    await db.execute(`INSERT INTO content_reports
      (reporter_id, post_id, reason, created_at)
      VALUES (?, ?, 'spam', UTC_TIMESTAMP(3))`, [admin.id, postId]);
    expect(await isAdmin(db, admin.publicId)).toBe(true);
    expect(await isAdmin(db, moderator.publicId)).toBe(false);
    expect(await administerAccount(db, moderator.publicId, owner.publicId,
      { action: "suspend", reason: "Sans droit" })).toBe("forbidden");
    expect(() => parseAdminAction({ action: "suspend", reason: "" }))
      .toThrow(TypeError);
    expect(await administerAccount(db, admin.publicId, moderator.publicId,
      { action: "role", role: "moderator", reason: "Équipe de confiance" })).toBe("ok");
    expect(await canModerate(db, moderator.publicId)).toBe(true);
    expect(await reviewContent(db, "post", publicPostId, moderator.publicId,
      "hide", "Signalement confirmé")).toBe("ok");
    expect(await reviewContent(db, "post", publicPostId, moderator.publicId,
      "restore", "Sans décision finale")).toBe("forbidden");
    expect(await getPost(db, publicPostId)).toBeNull();
    expect(await reviewContent(db, "post", publicPostId, admin.publicId,
      "restore", "Après réexamen")).toBe("ok");
    expect(await getPost(db, publicPostId)).not.toBeNull();
    expect(await reviewContent(db, "post", publicPostId, moderator.publicId,
      "hide", "Après décision finale")).toBe("forbidden");
    const [history] = await db.execute<(RowDataPacket & { decision: string; reason: string })[]>(
      "SELECT decision, reason FROM content_moderation_audit WHERE post_id = ? ORDER BY id",
      [postId],
    );
    expect(history.map((entry) => entry.decision)).toEqual(["hide", "restore"]);
    expect(history[0].reason).toBe("Signalement confirmé");
    const session = await startSession(db, moderator.publicId);
    expect(await administerAccount(db, admin.publicId, moderator.publicId,
      { action: "suspend", reason: "Suspension motivée" })).toBe("ok");
    expect(await touchSession(db, session)).toBeNull();
    expect(await canModerate(db, moderator.publicId)).toBe(false);
    expect(await administerAccount(db, admin.publicId, moderator.publicId,
      { action: "restore", reason: "Après appel accepté" })).toBe("ok");
    expect((await listAdminMembers(db, admin.publicId)).some(
      (member) => member.id === moderator.publicId && member.role === "moderator" &&
        member.status === "active")).toBe(true);
    const [actions] = await db.execute<(RowDataPacket & { action: string })[]>(
      "SELECT action FROM account_admin_audit WHERE target_id = ? ORDER BY id",
      [moderator.id],
    );
    expect(actions.map((entry) => entry.action)).toEqual(["role", "suspend", "restore"]);
  } finally {
    try {
      await db.rollback();
      if (postId) await db.execute("DELETE FROM posts WHERE id = ?", [postId]);
      for (const member of members) {
        await db.execute("DELETE FROM member_profiles WHERE member_id = ?", [member.id]);
        await db.execute("DELETE FROM members WHERE id = ?", [member.id]);
      }
    } finally {
      if (previous === undefined) delete process.env.KANU_ADMIN_IDS;
      else process.env.KANU_ADMIN_IDS = previous;
      db.release(); await pool.end();
    }
  }
}, 90_000);
