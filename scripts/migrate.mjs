import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import mysql from "mysql2/promise";

import { planMigrations } from
  "../src/server/database/plan-migrations.ts";

const migrationDirectory = fileURLToPath(
  new URL("../db/migrations/", import.meta.url),
);

function getTargetConfig(target) {
  if (target === "test") {
    return {
      database: "kanuconnecttest",
      user: "kanu_migrate_test",
      passwordVariable: "KANU_MIGRATE_TEST_DB_PASSWORD",
    };
  }

  if (target === "dev") {
    return {
      database: "kanuconnectdev",
      user: "kanu_migrate_dev",
      passwordVariable: "KANU_MIGRATE_DEV_DB_PASSWORD",
    };
  }

  throw new TypeError("Cible de migration invalide.");
}

async function readMigrationFiles() {
  const entries = await readdir(migrationDirectory, {
    withFileTypes: true,
  });

  const sqlFiles = entries.filter(
    (entry) => entry.isFile() && entry.name.endsWith(".sql"),
  );

  return Promise.all(
    sqlFiles.map(async (entry) => ({
      name: entry.name,
      sql: await readFile(
        join(migrationDirectory, entry.name),
        "utf8",
      ),
    })),
  );
}

export async function runMigrations(target, password) {
  const config = getTargetConfig(target);

  if (typeof password !== "string" || password.length === 0) {
    throw new TypeError("Mot de passe de migration absent.");
  }

  const files = await readMigrationFiles();

  // Vérifie les fichiers avant d'ouvrir une connexion.
  planMigrations(files, []);

  const connection = await mysql.createConnection({
    host: "127.0.0.1",
    port: 3306,
    user: config.user,
    password,
    database: config.database,
    charset: "utf8mb4",
    timezone: "Z",
    connectTimeout: 5_000,
    multipleStatements: false,
  });

  try {
    const [identities] = await connection.query(
      `
        SELECT
          DATABASE() AS databaseName,
          CURRENT_USER() AS authenticatedUser
      `,
    );

    if (
      identities[0]?.databaseName !== config.database ||
      identities[0]?.authenticatedUser !==
        `${config.user}@127.0.0.1`
    ) {
      throw new Error("Identité MySQL de migration inattendue.");
    }

    const lockName = `kanu:migrate:${config.database}`;

    const [locks] = await connection.execute(
      "SELECT GET_LOCK(?, 5) AS acquired",
      [lockName],
    );

    if (locks[0]?.acquired !== 1) {
      throw new Error("Verrou de migration indisponible.");
    }

    // Le verrou reste détenu par cette connexion jusqu'à sa fermeture.
    await connection.query(
      `
        CREATE TABLE IF NOT EXISTS _kanu_migrations (
          name VARCHAR(128)
            CHARACTER SET ascii
            COLLATE ascii_bin
            NOT NULL,
          checksum CHAR(64)
            CHARACTER SET ascii
            COLLATE ascii_bin
            NOT NULL,
          applied_at DATETIME(3) NOT NULL,

          PRIMARY KEY (name)
        )
        ENGINE = InnoDB
        DEFAULT CHARACTER SET = utf8mb4
        COLLATE = utf8mb4_0900_ai_ci
      `,
    );

    const [records] = await connection.query(
      `
        SELECT name, checksum
        FROM _kanu_migrations
        ORDER BY name
      `,
    );

    const pending = planMigrations(
      files,
      records.map((record) => ({
        name: record.name,
        checksum: record.checksum,
      })),
    );

    for (const migration of pending) {
      await connection.query(migration.sql);

      await connection.execute(
        `
          INSERT INTO _kanu_migrations
            (name, checksum, applied_at)
          VALUES (?, ?, UTC_TIMESTAMP(3))
        `,
        [migration.name, migration.checksum],
      );
    }

    return {
      database: config.database,
      applied: pending.map((migration) => migration.name),
    };
  } finally {
    await connection.end();
  }
}

if (import.meta.main) {
  const target = process.argv[2];

  try {
    const config = getTargetConfig(target);
    const password = process.env[config.passwordVariable];
    const result = await runMigrations(target, password);

    console.log(
      `Base ${result.database} : ` +
      `${result.applied.length} migration(s) appliquée(s).`,
    );
  } catch (error) {
    console.error(
      error instanceof Error
        ? error.message
        : "Migration MySQL impossible.",
    );

    process.exitCode = 1;
  }
}