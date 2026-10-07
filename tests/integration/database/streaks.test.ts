import { randomBytes } from "node:crypto";
import { createPool, type RowDataPacket } from "mysql2/promise";
import { expect, it } from "vitest";

import { registerEmail } from "@/server/auth/accounts";
import { createComment } from "@/server/comments/comment-repository";
import { createPost } from "@/server/posts/post-repository";
import { getReputation } from "@/server/reputation/reputation-repository";
import { getPublicStreak } from "@/server/streaks/streak-repository";
import { runMigrations } from "../../../scripts/migrate.mjs";

it("compte une journée utile une seule fois et accorde le bonus de trois jours", async () => {
  const appPassword = process.env.KANU_TEST_DB_PASSWORD;
  const migrationPassword = process.env.KANU_MIGRATE_TEST_DB_PASSWORD;
  if (!appPassword || !migrationPassword) throw new Error("Mots de passe MySQL de test absents.");
  await runMigrations("test", migrationPassword);
  const pool = createPool({
    host: "127.0.0.1", port: 3306, user: "kanu_app_test", password: appPassword,
    database: "kanuconnecttest", charset: "utf8mb4", timezone: "Z",
    multipleStatements: false,
  });
  const connection = await pool.getConnection();
  const suffix = randomBytes(8).toString("hex");
  const handle = `flame_${suffix}`;
  let memberId: number | undefined;
  try {
    await registerEmail(connection, {
      email: `flame_${suffix}@example.test`, password: "MotDePasse!123456",
      legalName: "Membre Flamme", handle,
    });
    const [members] = await connection.execute<(
      RowDataPacket & { id: number; publicId: string }
    )[]>(
      `SELECT m.id, m.public_id AS publicId FROM members m
       JOIN member_profiles p ON p.member_id = m.id WHERE p.handle = ?`, [handle],
    );
    memberId = members[0].id;
    const authorId = members[0].publicId;
    expect(await getPublicStreak(connection, handle)).toEqual({
      currentDays: 0, bestDays: 0, hasThreeDayBadge: false,
    });
    await connection.execute(
      `INSERT INTO member_streaks (member_id, current_days, best_days, last_active_day)
       VALUES (?, 2, 2, UTC_DATE() - INTERVAL 1 DAY)`, [memberId],
    );
    await connection.execute(
      `INSERT INTO member_streak_days (member_id, day_utc)
       VALUES (?, UTC_DATE() - INTERVAL 2 DAY), (?, UTC_DATE() - INTERVAL 1 DAY)`,
      [memberId, memberId],
    );
    const post = await createPost(connection, authorId, {
      kind: "question", space: "questions", title: "Troisième journée utile",
      body: "Question de test", code: null, codeLanguage: null, keywords: [],
    });
    expect(await getPublicStreak(connection, handle)).toEqual({
      currentDays: 3, bestDays: 3, hasThreeDayBadge: true,
    });
    expect(await getReputation(connection, handle)).toEqual({
      points: 10, badges: ["Premiers pas"],
    });
    await createComment(connection, post.id, authorId, {
      parentId: null, body: "Autre activité du même jour",
    });
    expect((await getPublicStreak(connection, handle))?.currentDays).toBe(3);
    expect((await getReputation(connection, handle))?.points).toBe(12);
    const [days] = await connection.execute<(RowDataPacket & { count: number })[]>(
      "SELECT COUNT(*) AS count FROM member_streak_days WHERE member_id = ?",
      [memberId],
    );
    expect(days[0].count).toBe(3);
    const [bonuses] = await connection.execute<(RowDataPacket & { count: number })[]>(
      `SELECT COUNT(*) AS count FROM member_reputation_events
       WHERE member_id = ? AND action = 'streak'`, [memberId],
    );
    expect(bonuses[0].count).toBe(1);
  } finally {
    try {
      if (memberId) {
        await connection.execute("DELETE FROM post_comments WHERE member_id = ?", [memberId]);
        await connection.execute(
          "DELETE FROM post_keywords WHERE post_id IN (SELECT id FROM posts WHERE member_id = ?)",
          [memberId],
        );
        await connection.execute("DELETE FROM posts WHERE member_id = ?", [memberId]);
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