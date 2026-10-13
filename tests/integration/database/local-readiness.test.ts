import { expect, it } from "vitest";
import { runMigrations } from "../../../scripts/migrate.mjs";
import { checkLocalReadiness } from "../../../scripts/check-local-readiness.mjs";

it("vérifie les comptes, le journal complet et les tables réelles sans modifier la base", async () => {
  const appPassword = process.env.KANU_TEST_DB_PASSWORD;
  const migrationPassword = process.env.KANU_MIGRATE_TEST_DB_PASSWORD;
  if (!appPassword || !migrationPassword) throw new Error("Mots de passe MySQL de test absents.");
  await runMigrations("test", migrationPassword);
  const report = await checkLocalReadiness("test", appPassword, migrationPassword);
  expect(report).toMatchObject({ ready: true, database: "kanuconnecttest", migrations: {
    files: 46, applied: 46, pending: 0, latest: "0046_account_admin_audit.sql",
  } });
  expect(report.applicationUser).toBe("kanu_app_test@127.0.0.1");
  expect(report.migrationUser).toBe("kanu_migrate_test@127.0.0.1");
}, 30_000);
