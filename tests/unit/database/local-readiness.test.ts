import { beforeAll, expect, it, vi } from "vitest";
import { planMigrations } from "@/server/database/plan-migrations";
import { checkLocalReadiness, formatReadinessError, readMigrationFiles, requiredTableNames } from "../../../scripts/check-local-readiness.mjs";
import mysql from "mysql2/promise";

let files: { name: string; sql: string }[];
beforeAll(async () => { files = await readMigrationFiles(); });

function fixture(change?: "pending" | "checksum" | "missingTable" | "column" | "engine" | "appIdentity" | "migrationIdentity" | "version" | "access") {
  const records = planMigrations(files, []).map(({ name, checksum }) => ({ name, checksum }));
  if (change === "pending") records.pop();
  if (change === "checksum") records[0].checksum = "0".repeat(64);
  const tables = [...requiredTableNames(files), "_kanu_migrations"].map((name) => ({ name, engine: "InnoDB", collationName: "utf8mb4_0900_ai_ci" }));
  if (change === "missingTable") tables.splice(tables.findIndex((table) => table.name === "posts"), 1);
  if (change === "engine") tables[0].engine = "MyISAM";
  const columns = ["id", "public_id", "created_at", "updated_at", "account_status", "account_role", "suspension_reason", "deleted_at"];
  if (change === "column") columns.pop();
  function connection(user: string) {
    return { query: vi.fn(async (query: { sql: string }) => {
      const sql = query.sql;
      if (sql.includes("CURRENT_USER")) return [[{ databaseName: change === "migrationIdentity" ? "kanuconnectdev" : "kanuconnecttest",
        authenticatedUser: change === "appIdentity" && user === "kanu_app_test" ? "root@localhost" : `${user}@127.0.0.1`,
        serverVersion: change === "version" ? "8.4.0" : "9.1.0" }]];
      if (sql.includes("FROM _kanu_migrations")) return [records];
      if (sql.includes("information_schema.TABLES")) return [tables];
      if (sql.includes("information_schema.COLUMNS")) return [columns.map((name) => ({ name }))];
      return [[]];
    }), end: vi.fn(async () => {}) };
  }
  const migration = connection("kanu_migrate_test");
  const application = connection("kanu_app_test");
  const connect = vi.fn(async (options: { user: string }) => {
    if (change === "access") throw Object.assign(new Error("mot-de-passe-prive"), { code: "ER_ACCESS_DENIED_ERROR" });
    return options.user === "kanu_app_test" ? application : migration;
  });
  return { connect: connect as unknown as typeof mysql.createConnection, migration, application };
}

it("reconnaît les migrations et ferme les connexions en lecture seule", async () => {
  expect(requiredTableNames(files)).toContain("member_notifications");
  expect(requiredTableNames(files)).not.toContain("project_notifications");
  const { connect, migration, application } = fixture();
  const report = await checkLocalReadiness("test", "app-private", "migrate-private", connect);
  expect(report).toMatchObject({ ready: true, database: "kanuconnecttest", migrations: { files: 46, applied: 46, pending: 0 } });
  expect(migration.end).toHaveBeenCalledOnce(); expect(application.end).toHaveBeenCalledOnce();
  for (const [query] of [...migration.query.mock.calls, ...application.query.mock.calls]) expect(query.sql.trimStart()).toMatch(/^SELECT\b/u);
  expect(JSON.stringify(report)).not.toContain("private");
});

it.each(["pending", "checksum", "missingTable", "column", "engine", "migrationIdentity", "version"] as const)(
  "refuse un état non prêt (%s) et ferme la connexion",
  async (change) => {
    const { connect, migration } = fixture(change);
    await expect(checkLocalReadiness("test", "app-private", "migrate-private", connect)).rejects.toThrow();
    expect(migration.end).toHaveBeenCalledOnce();
  },
);

it("refuse un compte applicatif inattendu et ferme les deux connexions", async () => {
  const { connect, migration, application } = fixture("appIdentity");
  await expect(checkLocalReadiness("test", "app-private", "migrate-private", connect)).rejects.toThrow("compte MySQL inattendu");
  expect(migration.end).toHaveBeenCalledOnce(); expect(application.end).toHaveBeenCalledOnce();
});

it("ne divulgue pas le détail d'une erreur MySQL", async () => {
  const { connect } = fixture("access");
  await expect(checkLocalReadiness("test", "app-private", "migrate-private", connect)).rejects.toThrow("identifiants prives");
  expect(formatReadinessError(new Error("mot-de-passe-prive"))).not.toContain("mot-de-passe-prive");
});

it("refuse une cible ou des secrets absents avant la connexion", async () => {
  const { connect } = fixture();
  await expect(checkLocalReadiness("production", "app-private", "migrate-private", connect)).rejects.toThrow("Cible locale invalide");
  await expect(checkLocalReadiness("test", "", "migrate-private", connect)).rejects.toThrow("Identifiants locaux absents");
  expect(connect).not.toHaveBeenCalled();
});
