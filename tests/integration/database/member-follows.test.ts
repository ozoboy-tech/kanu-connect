import { randomBytes } from "node:crypto";
import { createPool, type RowDataPacket } from "mysql2/promise";
import { expect, it } from "vitest";

import { registerEmail } from "@/server/auth/accounts";
import {
  getFollowStats, listConnections, setFollow,
} from "@/server/members/follow-repository";
import { runMigrations } from "../../../scripts/migrate.mjs";

it("permet de suivre une fois, interdit son propre compte et conserve le lien après changement de pseudo", async () => {
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
  const first = `fa_${suffix}`;
  const second = `fb_${suffix}`;
  const renamed = `fc_${suffix}`;
  const ids: number[] = [];
  const members: { id: number; publicId: string; handle: string }[] = [];
  try {
    for (const [index, handle] of [first, second].entries()) {
      await registerEmail(connection, {
        email: `follow_${index}_${suffix}@example.test`,
        password: "MotDePasse!123456", legalName: `Nom Test ${index}`, handle,
      });
      const [rows] = await connection.execute<(
        RowDataPacket & { id: number; publicId: string; handle: string }
      )[]>(
        `SELECT m.id, m.public_id AS publicId, p.handle
         FROM members m JOIN member_profiles p ON p.member_id = m.id
         WHERE p.handle = ?`, [handle],
      );
      ids.push(rows[0].id);
      members.push(rows[0]);
    }
    const follower = members.find((member) => member.handle === first)!;
    const target = members.find((member) => member.handle === second)!;

    expect(await setFollow(connection, second, follower.publicId, true)).toBe("ok");
    expect(await setFollow(connection, second, follower.publicId, true)).toBe("ok");
    expect(await getFollowStats(connection, second, follower.publicId)).toEqual({
      followerCount: 1, followingCount: 0, isFollowing: true,
    });
    expect(await getFollowStats(connection, first, null)).toEqual({
      followerCount: 0, followingCount: 1, isFollowing: false,
    });
    expect(await listConnections(connection, second, "followers")).toEqual([first]);
    expect(await listConnections(connection, first, "following")).toEqual([second]);
    expect(await setFollow(connection, first, follower.publicId, true)).toBe("self");
    expect(await setFollow(connection, "absent", follower.publicId, true)).toBe("not_found");

    await connection.execute(
      "UPDATE member_profiles SET handle = ? WHERE member_id = ?", [renamed, target.id],
    );
    expect((await getFollowStats(connection, renamed, follower.publicId))?.isFollowing)
      .toBe(true);
    expect(await listConnections(connection, first, "following")).toEqual([renamed]);
    expect(await setFollow(connection, renamed, follower.publicId, false)).toBe("ok");
    expect(await setFollow(connection, renamed, follower.publicId, false)).toBe("ok");
    expect((await getFollowStats(connection, renamed, follower.publicId))?.followerCount)
      .toBe(0);
  } finally {
    try {
      for (const id of ids) {
        for (const table of [
          "member_profile_skills", "member_profile_hobbies", "member_auth_tokens",
          "member_sessions", "member_oauth_link_intents", "member_oauth_accounts",
          "member_email_credentials", "member_profiles", "member_private_identities",
        ]) await connection.query(`DELETE FROM ${table} WHERE member_id = ?`, [id]);
        await connection.execute("DELETE FROM members WHERE id = ?", [id]);
      }
    } finally { connection.release(); await pool.end(); }
  }
}, 90_000);
