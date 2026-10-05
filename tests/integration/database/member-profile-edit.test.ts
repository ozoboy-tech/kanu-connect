import { randomBytes } from "node:crypto";
import { createPool, type RowDataPacket } from "mysql2/promise";
import { expect, it } from "vitest";

import { registerEmail } from "@/server/auth/accounts";
import {
  getOwnProfile, getPublicProfile, updateOwnProfile,
} from "@/server/members/profile-repository";
import { runMigrations } from "../../../scripts/migrate.mjs";

it("édite le profil et garde le nom légal hors de la lecture publique", async () => {
  const appPassword = process.env.KANU_TEST_DB_PASSWORD;
  const migrationPassword = process.env.KANU_MIGRATE_TEST_DB_PASSWORD;
  if (!appPassword || !migrationPassword) {
    throw new Error("Mots de passe MySQL de test absents.");
  }
  await runMigrations("test", migrationPassword);
  const pool = createPool({
    host: "127.0.0.1", port: 3306, user: "kanu_app_test",
    password: appPassword, database: "kanuconnecttest", charset: "utf8mb4",
    timezone: "Z", multipleStatements: false,
  });
  const connection = await pool.getConnection();
  const suffix = randomBytes(8).toString("hex");
  const firstHandle = `p_${suffix}`;
  const otherHandle = `q_${suffix}`;
  const newHandle = `r_${suffix}`;
  const memberIds: number[] = [];
  try {
    for (const [index, handle] of [firstHandle, otherHandle].entries()) {
      await registerEmail(connection, {
        email: `profile_${index}_${suffix}@example.test`,
        password: "MotDePasse!123456", legalName: `Nom privé ${index}`,
        handle,
      });
      const [rows] = await connection.execute<(RowDataPacket & { id: number })[]>(
        `SELECT m.id FROM members m
         JOIN member_profiles p ON p.member_id = m.id WHERE p.handle = ?`,
        [handle],
      );
      memberIds.push(rows[0].id);
    }
    const [members] = await connection.execute<(RowDataPacket & { publicId: string })[]>(
      "SELECT public_id AS publicId FROM members WHERE id = ?", [memberIds[0]],
    );
    const publicId = members[0].publicId;
    const result = await updateOwnProfile(connection, publicId, {
      handle: newHandle,
      photoUrl: "https://example.org/avatar.png",
      bio: "Développeuse", location: "Bamako",
      skills: ["Python", "TypeScript"], hobbies: ["Photographie"],
    });
    expect(result?.legalName).toBe("Nom privé 0");
    expect(result?.handle).toBe(newHandle);
    expect(await getPublicProfile(connection, firstHandle)).toBeNull();
    const visible = await getPublicProfile(connection, newHandle);
    expect(visible).toMatchObject({
      handle: newHandle, bio: "Développeuse", location: "Bamako",
      skills: ["Python", "TypeScript"], hobbies: ["Photographie"],
    });
    expect(visible).not.toHaveProperty("legalName");
    expect((await getOwnProfile(connection, publicId))?.legalName)
      .toBe("Nom privé 0");
    await expect(updateOwnProfile(connection, publicId, {
      handle: otherHandle, photoUrl: null, bio: null, location: null,
      skills: [], hobbies: [],
    })).rejects.toMatchObject({ code: "ER_DUP_ENTRY" });
    expect((await getPublicProfile(connection, newHandle))?.skills)
      .toEqual(["Python", "TypeScript"]);
  } finally {
    try {
      for (const id of memberIds) {
        for (const table of [
          "member_profile_skills", "member_profile_hobbies", "member_sessions",
          "member_auth_tokens", "member_oauth_link_intents", "member_oauth_accounts",
          "member_email_credentials", "member_profiles", "member_private_identities",
        ]) {
          await connection.query(`DELETE FROM ${table} WHERE member_id = ?`, [id]);
        }
        await connection.execute("DELETE FROM members WHERE id = ?", [id]);
      }
    } finally { connection.release(); await pool.end(); }
  }
}, 90_000);