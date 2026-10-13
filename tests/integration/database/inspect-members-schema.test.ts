import { createConnection, type RowDataPacket } from "mysql2/promise";
import { expect, it } from "vitest";

import { inspectMembersSchema } from "@/server/database/verify-members-schema";
import { runMigrations } from "../../../scripts/migrate.mjs";

interface ColumnRow extends RowDataPacket {
  name: string;
}

it("vérifie la structure évoluée de members sans la confondre avec 0001", async () => {
  const password = process.env.KANU_MIGRATE_TEST_DB_PASSWORD;
  if (!password) throw new Error("Mot de passe de migration de test absent.");

  await runMigrations("test", password);

  const connection = await createConnection({
    host: "127.0.0.1", port: 3306, user: "kanu_migrate_test", password,
    database: "kanuconnecttest", multipleStatements: false,
  });
  try {
    const [columns] = await connection.query<ColumnRow[]>(`
      SELECT COLUMN_NAME AS name
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'members'
      ORDER BY ORDINAL_POSITION
    `);

    expect(columns.map((column) => column.name)).toEqual([
      "id", "public_id", "created_at", "updated_at",
      "account_status", "account_role", "suspension_reason", "deleted_at",
    ]);
    expect(await inspectMembersSchema(connection)).toBe(false);
  } finally {
    await connection.end();
  }
}, 30_000);