import { createConnection, type RowDataPacket } from "mysql2/promise";
import { expect, it } from "vitest";

import { runMigrations } from "../../../scripts/migrate.mjs";

interface CountRow extends RowDataPacket {
  total: number;
}

interface MigrationRow extends RowDataPacket {
  checksum: string;
}

it(
  "applique la première migration une seule fois dans la base de test",
  async () => {
    const password = process.env.KANU_MIGRATE_TEST_DB_PASSWORD;

    if (!password) {
      throw new Error("Le mot de passe du compte de migration de test est absent.");
    }

    const firstRun = await runMigrations("test", password);
    const secondRun = await runMigrations("test", password);

    expect(firstRun.database).toBe("kanuconnecttest");
    expect(secondRun.database).toBe("kanuconnecttest");
    expect(secondRun.applied).toEqual([]);

    const connection = await createConnection({
      host: "127.0.0.1",
      port: 3306,
      user: "kanu_migrate_test",
      password,
      database: "kanuconnecttest",
      multipleStatements: false,
    });

    try {
      const [columns] = await connection.execute<CountRow[]>(
        `
          SELECT COUNT(*) AS total
          FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = 'members'
            AND COLUMN_NAME IN (
              'id',
              'public_id',
              'created_at',
              'updated_at'
            )
        `,
      );

      expect(columns[0].total).toBe(4);

      const [records] = await connection.execute<MigrationRow[]>(
        `
          SELECT checksum
          FROM _kanu_migrations
          WHERE name = ?
        `,
        ["0001_members.sql"],
      );

      expect(records).toHaveLength(1);
      expect(records[0].checksum).toMatch(/^[0-9a-f]{64}$/);
    } finally {
      await connection.end();
    }
  },
  30_000,
);