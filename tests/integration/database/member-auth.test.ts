import { randomBytes } from "node:crypto";
import { createPool, type RowDataPacket } from "mysql2/promise";
import { expect, it } from "vitest";

import {
  authenticateEmail, completeOAuthOnboarding,
  consumeEmailToken, consumeOAuthLinkIntent,
  createOAuthLinkIntent, issueEmailToken, registerEmail, resolveOAuthMember,
} from "@/server/auth/accounts";
import { hashToken, revokeSession, startSession, touchSession } from "@/server/auth/session-store";
import { runMigrations } from "../../../scripts/migrate.mjs";

it("inscrit, vérifie, réinitialise, révoque et rattache sans fusion automatique", async () => {
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
  const email = `auth_${suffix}@example.test`;
  const accountId = `test-${suffix}`;
  const linkedId = `linked-${suffix}`;
  const publicIds: string[] = [];
  try {
    const registered = await registerEmail(connection, {
      email, password: "MotDePasse!123456", legalName: "Awa Test",
      handle: `u_${suffix}`,
    });
    expect(await authenticateEmail(connection, email, "MotDePasse!123456")).toBeNull();
    expect(await issueEmailToken(connection, email, "reset")).toBeNull();
    expect(await consumeEmailToken(connection, registered.token, "verify")).toBe(true);
    expect(await consumeEmailToken(connection, registered.token, "verify")).toBe(false);
    const member = await authenticateEmail(connection, email, "MotDePasse!123456");
    expect(member).toBeTruthy();
    publicIds.push(member!);
    const secret = await startSession(connection, member!);
    expect(await touchSession(connection, secret)).toMatchObject({
      publicId: member, onboarded: true,
    });
    const idle = await startSession(connection, member!);
    await connection.execute(
      `UPDATE member_sessions
       SET last_seen_at = UTC_TIMESTAMP(3) - INTERVAL 8 DAY
       WHERE token_hash = ?`, [hashToken(idle)],
    );
    expect(await touchSession(connection, idle)).toBeNull();
    const old = await startSession(connection, member!);
    await connection.execute(
      `UPDATE member_sessions
       SET expires_at = UTC_TIMESTAMP(3) - INTERVAL 1 SECOND
       WHERE token_hash = ?`, [hashToken(old)],
    );
    expect(await touchSession(connection, old)).toBeNull();

    const oauth = await resolveOAuthMember(connection, "github", accountId);
    publicIds.push(oauth);
    expect(oauth).not.toBe(member);
    expect(await touchSession(connection, await startSession(connection, oauth)))
      .toMatchObject({ onboarded: false });
    await completeOAuthOnboarding(connection, oauth, "Fatou Test", null);

    const intent = await createOAuthLinkIntent(connection, member!, "gitlab");
    expect(await consumeOAuthLinkIntent(connection, intent, "gitlab", linkedId)).toBe(member);
    expect(await consumeOAuthLinkIntent(connection, intent, "gitlab", linkedId)).toBeNull();
    expect(await resolveOAuthMember(connection, "gitlab", linkedId)).toBe(member);

    const reset = await issueEmailToken(connection, email, "reset");
    expect(reset).toBeTruthy();
    expect(await consumeEmailToken(connection, reset!.token, "reset", "NouveauMotDePasse!2026"))
      .toBe(true);
    expect(await touchSession(connection, secret)).toBeNull();
    expect(await authenticateEmail(connection, email, "MotDePasse!123456")).toBeNull();
    expect(await authenticateEmail(connection, email, "NouveauMotDePasse!2026")).toBe(member);
    const fresh = await startSession(connection, member!);
    await revokeSession(connection, fresh);
    expect(await touchSession(connection, fresh)).toBeNull();
  } finally {
    try {
      for (const publicId of publicIds) {
        const [rows] = await connection.execute<(RowDataPacket & { id: number })[]>(
          "SELECT id FROM members WHERE public_id = ?", [publicId],
        );
        if (!rows[0]) continue;
        const id = rows[0].id;
        for (const table of [
          "member_sessions", "member_auth_tokens", "member_oauth_link_intents",
          "member_oauth_accounts", "member_email_credentials", "member_profiles",
          "member_private_identities",
        ]) await connection.query(`DELETE FROM ${table} WHERE member_id = ?`, [id]);
        await connection.execute("DELETE FROM members WHERE id = ?", [id]);
      }
    } finally { connection.release(); await pool.end(); }
  }
}, 90_000);
