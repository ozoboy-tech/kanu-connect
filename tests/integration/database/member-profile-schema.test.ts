import { randomUUID } from "node:crypto";
import {
  createConnection,
  type ResultSetHeader,
  type RowDataPacket,
} from "mysql2/promise";
import { expect, it } from "vitest";

import { chooseHandle } from "@/modules/members/domain/choose-handle";
import { runMigrations } from "../../../scripts/migrate.mjs";

interface ProfileRow extends RowDataPacket {
  handle: string;
  photo_url: string | null;
  bio: string | null;
  location: string | null;
}

it("protège le nom légal et impose un pseudo unique", async () => {
  const appPassword = process.env.KANU_TEST_DB_PASSWORD;
  const migrationPassword = process.env.KANU_MIGRATE_TEST_DB_PASSWORD;

  if (!appPassword || !migrationPassword) {
    throw new Error("Mots de passe MySQL de test absents.");
  }

  await runMigrations("test", migrationPassword);

  const connection = await createConnection({
    host: "127.0.0.1",
    port: 3306,
    user: "kanu_app_test",
    password: appPassword,
    database: "kanuconnecttest",
    charset: "utf8mb4",
    multipleStatements: false,
  });

  try {
    await connection.beginTransaction();

    const [first] = await connection.execute<ResultSetHeader>(
      `INSERT INTO members (public_id, created_at, updated_at)
       VALUES (?, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3))`,
      [randomUUID()],
    );
    const [second] = await connection.execute<ResultSetHeader>(
      `INSERT INTO members (public_id, created_at, updated_at)
       VALUES (?, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3))`,
      [randomUUID()],
    );

    await connection.execute(
      `INSERT INTO member_private_identities
         (member_id, legal_name)
       VALUES (?, ?)`,
      [first.insertId, "Awa Traoré"],
    );
    await expect(connection.execute(
      `INSERT INTO member_private_identities
         (member_id, legal_name)
       VALUES (?, ?)`,
      [second.insertId, "   "],
    )).rejects.toMatchObject({
      code: "ER_CHECK_CONSTRAINT_VIOLATED",
    });

    await connection.execute(
      `INSERT INTO member_profiles
         (member_id, handle, bio, location, created_at, updated_at)
       VALUES (?, ?, ?, ?, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3))`,
      [first.insertId, "awa_dev", "Développeuse", "Bamako"],
    );
    await expect(connection.execute(
      `INSERT INTO member_profiles
         (member_id, handle, created_at, updated_at)
       VALUES (?, ?, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3))`,
      [second.insertId, "awa_dev"],
    )).rejects.toMatchObject({ code: "ER_DUP_ENTRY" });
    await expect(connection.execute(
      `INSERT INTO member_profiles
         (member_id, handle, created_at, updated_at)
       VALUES (?, ?, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3))`,
      [second.insertId, "Bad Alias"],
    )).rejects.toMatchObject({
      code: "ER_CHECK_CONSTRAINT_VIOLATED",
    });

    await connection.execute(
      "INSERT INTO member_profile_skills (member_id, label) VALUES (?, ?)",
      [first.insertId, "TypeScript"],
    );
    await connection.execute(
      "INSERT INTO member_profile_hobbies (member_id, label) VALUES (?, ?)",
      [first.insertId, "Photographie"],
    );

    expect(await chooseHandle(
      connection,
      null,
      () => "abcdef123456",
    )).toBe("kanu_abcdef123456");

    const [profiles] = await connection.execute<ProfileRow[]>(
      `SELECT handle, photo_url, bio, location
       FROM member_profiles
       WHERE member_id = ?`,
      [first.insertId],
    );

    expect(profiles[0].handle).toBe("awa_dev");
    expect(profiles[0].bio).toBe("Développeuse");
    expect(profiles[0].location).toBe("Bamako");
    expect(profiles[0]).not.toHaveProperty("legal_name");
  } finally {
    try {
      await connection.rollback();
    } finally {
      await connection.end();
    }
  }
}, 30_000);