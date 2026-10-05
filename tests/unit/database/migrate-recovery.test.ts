import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createConnection: vi.fn(),
  inspectMembersSchema: vi.fn(),
}));

vi.mock("mysql2/promise", () => ({
  default: { createConnection: mocks.createConnection },
}));

vi.mock("../../../src/server/database/verify-members-schema.ts", () => ({
  inspectMembersSchema: mocks.inspectMembersSchema,
}));

import {
  reconcileMembersMigration,
  runMigrations,
} from "../../../scripts/migrate.mjs";

function prepareConnection(tableExists: boolean, applied: {name: string;checksum: string}[] = []) {
  const connection = {
    query: vi.fn(async (statement: string) => {
      if (statement.includes("CURRENT_USER()")) {
        return [[{
          databaseName: "kanuconnecttest",
          authenticatedUser: "kanu_migrate_test@127.0.0.1",
        }]];
      }
      if (statement.includes("FROM _kanu_migrations")) return [applied];
      if (statement.includes("information_schema.TABLES")) {
        return [tableExists ? [{ present: 1 }] : []];
      }
      if (statement.includes("CREATE TABLE IF NOT EXISTS _kanu_migrations") ||
          statement.includes("CREATE TABLE `members`")) return [[]];
      throw new Error(`Requête inattendue : ${statement}`);
    }),
    execute: vi.fn(async (statement: string) => {
      if (statement.includes("GET_LOCK")) return [[{ acquired: 1 }]];
      if (statement.includes("INSERT INTO _kanu_migrations")) return [{}];
      throw new Error(`Commande inattendue : ${statement}`);
    }),
    end: vi.fn(async () => {}),
  };
  mocks.createConnection.mockResolvedValue(connection);
  return connection;
}

describe("Reprise contrôlée de la migration members", () => {
  beforeEach(() => vi.resetAllMocks());

  it("bloque l'exécution normale si members existe sans journal", async () => {
    const connection = prepareConnection(true);
    await expect(runMigrations("test", "secret")).rejects.toThrow(/reconcile/);
    expect(connection.query).not.toHaveBeenCalledWith(expect.stringContaining("CREATE TABLE `members`"));
    expect(connection.execute).not.toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO _kanu_migrations"), expect.anything(),
    );
    expect(connection.end).toHaveBeenCalledOnce();
  });

  it("n'inscrit 0001 qu'après inspection exacte", async () => {
    const connection = prepareConnection(true);
    mocks.inspectMembersSchema.mockResolvedValue(true);
    expect(await reconcileMembersMigration("test", "secret")).toEqual({
      database: "kanuconnecttest", reconciled: true,
    });
    expect(mocks.inspectMembersSchema).toHaveBeenCalledWith(connection);
    expect(connection.execute).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO _kanu_migrations"),
      ["0001_members.sql", expect.stringMatching(/^[a-f0-9]{64}$/)],
    );
  });

  it("refuse de journaliser une structure différente", async () => {
    const connection = prepareConnection(true);
    mocks.inspectMembersSchema.mockResolvedValue(false);
    await expect(reconcileMembersMigration("test", "secret")).rejects.toThrow(/non conforme/);
    expect(connection.execute).not.toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO _kanu_migrations"), expect.anything(),
    );
  });

  it("refuse la reprise d'une table absente", async () => {
    prepareConnection(false);
    await expect(reconcileMembersMigration("test", "secret")).rejects.toThrow(/absente/);
    expect(mocks.inspectMembersSchema).not.toHaveBeenCalled();
  });

  it("applique 0001 normalement si la table est absente", async () => {
    const connection = prepareConnection(false);
    expect((await runMigrations("test", "secret")).applied).toEqual(["0001_members.sql"]);
    expect(connection.query).toHaveBeenCalledWith(expect.stringContaining("CREATE TABLE `members`"));
  });

  it("n'inscrit rien quand 0001 figure déjà dans le journal", async () => {
    const { readFile } = await import("node:fs/promises");
    const { planMigrations } = await import("../../../src/server/database/plan-migrations");
    const sql = await readFile(new URL("../../../db/migrations/0001_members.sql", import.meta.url), "utf8");
    const checksum = planMigrations([{ name: "0001_members.sql", sql }], [])[0].checksum;
    const connection = prepareConnection(true, [{ name: "0001_members.sql", checksum }]);

    expect(await reconcileMembersMigration("test", "secret")).toEqual({
      database: "kanuconnecttest", reconciled: false,
    });
    expect(connection.execute).not.toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO _kanu_migrations"), expect.anything(),
    );
  });
});
