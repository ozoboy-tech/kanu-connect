import { readFile, readdir } from "node:fs/promises";
import mysql from "mysql2/promise";
import { planMigrations } from "../src/server/database/plan-migrations.ts";

export class ReadinessError extends Error {}

function targetConfig(target) {
  if (target !== "dev" && target !== "test") throw new ReadinessError("Cible locale invalide : dev ou test attendu.");
  return { database: `kanuconnect${target}`, applicationUser: `kanu_app_${target}`, migrationUser: `kanu_migrate_${target}` };
}

export async function readMigrationFiles() {
  const directory = new URL("../db/migrations/", import.meta.url);
  const entries = await readdir(directory, { withFileTypes: true });
  return Promise.all(entries.filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
    .map(async (entry) => ({ name: entry.name, sql: await readFile(new URL(entry.name, directory), "utf8") })));
}

export function requiredTableNames(files) {
  const names = new Set();
  for (const file of planMigrations(files, [])) {
    const changes = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?`([a-z0-9_]+)`|ALTER\s+TABLE\s+`([a-z0-9_]+)`[^;]*?\bRENAME\s+(?:TO|AS)\s+`([a-z0-9_]+)`/giu;
    for (const match of file.sql.matchAll(changes)) {
      if (match[1]) names.add(match[1]);
      else {
        names.delete(match[2]);
        names.add(match[3]);
      }
    }
  }
  return [...names].sort();
}

async function identity(connection, database, user) {
  const [rows] = await connection.query({
    sql: "SELECT DATABASE() AS databaseName, CURRENT_USER() AS authenticatedUser, VERSION() AS serverVersion",
    timeout: 3000,
  });
  const row = rows[0];
  if (row?.databaseName !== database || row?.authenticatedUser !== `${user}@127.0.0.1`) {
    throw new ReadinessError("Base ou compte MySQL inattendu.");
  }
  if (typeof row.serverVersion !== "string" || !/^9\.1\.\d+(?:[-.].*)?$/u.test(row.serverVersion)) {
    throw new ReadinessError("Le serveur local attendu est MySQL 9.1.x sur 127.0.0.1:3306.");
  }
  return row;
}

export function formatReadinessError(error) {
  if (error instanceof ReadinessError) return error.message;
  if (error && typeof error === "object" && "code" in error) {
    if (error.code === "ER_ACCESS_DENIED_ERROR") return "Connexion MySQL refusee : verifier les identifiants prives du PC.";
    if (error.code === "ER_BAD_DB_ERROR") return "Base locale absente : suivre le guide d'installation Windows.";
    if (error.code === "ER_NO_SUCH_TABLE") return "Schema ou journal absent : appliquer les migrations locales.";
    if (["ECONNREFUSED", "ETIMEDOUT"].includes(error.code)) return "MySQL indisponible : verifier Wamp et le port 3306.";
  }
  return "Controle local impossible. Verifier Wamp, les identifiants prives et les migrations.";
}

// Lecture seule : aucun CREATE, ALTER, INSERT, UPDATE ou DELETE.
export async function checkLocalReadiness(target, applicationPassword, migrationPassword, connect = mysql.createConnection) {
  const config = targetConfig(target);
  if (typeof applicationPassword !== "string" || !applicationPassword ||
      typeof migrationPassword !== "string" || !migrationPassword) {
    throw new ReadinessError("Identifiants locaux absents : utiliser scripts/run-phase3-checks.ps1.");
  }
  const files = await readMigrationFiles();
  const ordered = planMigrations(files, []);
  if (!ordered.length) throw new ReadinessError("Aucun fichier de migration trouve.");
  const options = { host: "127.0.0.1", port: 3306, database: config.database,
    charset: "utf8mb4", timezone: "Z", connectTimeout: 5000, multipleStatements: false };
  let migrationConnection;
  let applicationConnection;
  try {
    migrationConnection = await connect({ ...options, user: config.migrationUser, password: migrationPassword });
    const migrationIdentity = await identity(migrationConnection, config.database, config.migrationUser);
    const [records] = await migrationConnection.query({
      sql: "SELECT name, checksum FROM _kanu_migrations ORDER BY name", timeout: 3000,
    });
    let pending;
    try { pending = planMigrations(files, records); }
    catch { throw new ReadinessError("Journal des migrations incoherent : verifier docs/migration-recovery.md."); }
    if (pending.length) throw new ReadinessError(`${pending.length} migration(s) en attente : lancer scripts/migrate-local.ps1 -Target ${target}.`);

    const [tables] = await migrationConnection.query({
      sql: "SELECT TABLE_NAME AS name, ENGINE AS engine, TABLE_COLLATION AS collationName FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_TYPE='BASE TABLE'",
      timeout: 3000,
    });
    const expectedTables = requiredTableNames(files);
    for (const name of [...expectedTables, "_kanu_migrations"]) {
      if (!tables.some((table) => table.name === name && table.engine === "InnoDB")) {
        throw new ReadinessError(`Table ${name} absente ou moteur InnoDB incorrect.`);
      }
    }
    if (tables.find((table) => table.name === "members")?.collationName !== "utf8mb4_0900_ai_ci") {
      throw new ReadinessError("Collation de members non conforme.");
    }
    const [columns] = await migrationConnection.query({
      sql: "SELECT COLUMN_NAME AS name FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='members' ORDER BY ORDINAL_POSITION",
      timeout: 3000,
    });
    const expectedColumns = ["id", "public_id", "created_at", "updated_at", "account_status", "account_role", "suspension_reason", "deleted_at"];
    if (columns.length !== expectedColumns.length || columns.some((column, index) => column.name !== expectedColumns[index])) {
      throw new ReadinessError("Structure de members non conforme aux migrations actuelles.");
    }
    applicationConnection = await connect({ ...options, user: config.applicationUser, password: applicationPassword });
    await identity(applicationConnection, config.database, config.applicationUser);
    // Confirme que le compte applicatif peut lire les tables du parcours principal.
    await applicationConnection.query({ sql: "SELECT id FROM members LIMIT 1", timeout: 3000 });
    await applicationConnection.query({ sql: "SELECT id FROM posts LIMIT 1", timeout: 3000 });
    return { ready: true, target, database: config.database, serverVersion: migrationIdentity.serverVersion,
      applicationUser: `${config.applicationUser}@127.0.0.1`, migrationUser: `${config.migrationUser}@127.0.0.1`,
      migrations: { files: files.length, applied: records.length, pending: 0, latest: ordered.at(-1).name },
      tablesChecked: expectedTables.length + 1 };
  } catch (error) { throw new ReadinessError(formatReadinessError(error)); }
  finally {
    // Fermer les deux connexions même si la fermeture de la première échoue.
    const closures = [];
    if (applicationConnection) closures.push(applicationConnection.end());
    if (migrationConnection) closures.push(migrationConnection.end());
    await Promise.allSettled(closures);
  }
}

if (import.meta.main) {
  try {
    const [target, extra] = process.argv.slice(2);
    if (extra !== undefined) throw new ReadinessError("Usage : node scripts/check-local-readiness.mjs dev|test");
    targetConfig(target);
    const applicationPassword = process.env[target === "test" ? "KANU_TEST_DB_PASSWORD" : "KANU_DEV_DB_PASSWORD"];
    const migrationPassword = process.env[target === "test" ? "KANU_MIGRATE_TEST_DB_PASSWORD" : "KANU_MIGRATE_DEV_DB_PASSWORD"];
    console.log(JSON.stringify(await checkLocalReadiness(target, applicationPassword, migrationPassword), null, 2));
  } catch (error) {
    console.error(formatReadinessError(error));
    process.exitCode = 1;
  }
}
