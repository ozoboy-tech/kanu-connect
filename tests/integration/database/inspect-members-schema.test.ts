import { createConnection } from "mysql2/promise";
import { expect, it } from "vitest";

import { inspectMembersSchema } from "@/server/database/verify-members-schema";

it("reconnaît la structure réelle de members dans la base de test", async () => {
  const password = process.env.KANU_MIGRATE_TEST_DB_PASSWORD;
  if (!password) throw new Error("Mot de passe de migration de test absent.");

  const connection = await createConnection({
    host: "127.0.0.1", port: 3306, user: "kanu_migrate_test", password,
    database: "kanuconnecttest", multipleStatements: false,
  });
  try {
    expect(await inspectMembersSchema(connection)).toBe(true);
  } finally {
    await connection.end();
  }
}, 30_000);
