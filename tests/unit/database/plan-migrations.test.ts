import { describe, expect, it } from "vitest";

import {
  planMigrations,
  type MigrationFile,
} from "@/server/database/plan-migrations";

const first: MigrationFile = {
  name: "0001_members.sql",
  sql: "CREATE TABLE members (id BIGINT PRIMARY KEY);",
};

const second: MigrationFile = {
  name: "0002_member_profiles.sql",
  sql: "ALTER TABLE members ADD COLUMN display_name VARCHAR(100);",
};

describe("Planification des migrations MySQL", () => {
  it("ordonne les migrations et calcule leur empreinte", () => {
    const pending = planMigrations([second, first], []);

    expect(pending.map((migration) => migration.name)).toEqual([
      "0001_members.sql",
      "0002_member_profiles.sql",
    ]);

    expect(pending[0].checksum).toMatch(/^[0-9a-f]{64}$/);
    expect(pending[1].checksum).not.toBe(pending[0].checksum);
  });

  it("ne rejoue pas une migration déjà appliquée", () => {
    const checksum = planMigrations([first], [])[0].checksum;

    expect(
      planMigrations([first, second], [
        { name: first.name, checksum },
      ]).map((migration) => migration.name),
    ).toEqual(["0002_member_profiles.sql"]);
  });

  it("refuse la modification d'une migration déjà appliquée", () => {
    const checksum = planMigrations([first], [])[0].checksum;

    expect(() =>
      planMigrations(
        [{ ...first, sql: `${first.sql}\n-- modification` }],
        [{ name: first.name, checksum }],
      ),
    ).toThrow("Empreinte");
  });

  it("refuse une migration appliquée absente des fichiers", () => {
    expect(() =>
      planMigrations([first], [
        { name: "0000_unknown.sql", checksum: "a".repeat(64) },
      ]),
    ).toThrow();
  });

  it("refuse un trou dans l'historique appliqué", () => {
    const checksum = planMigrations([second], [])[0].checksum;

    expect(() =>
      planMigrations([first, second], [
        { name: second.name, checksum },
      ]),
    ).toThrow();
  });

  it("refuse deux fichiers avec le même numéro", () => {
    expect(() =>
      planMigrations(
        [
          first,
          {
            name: "0001_other.sql",
            sql: "CREATE TABLE other_table (id BIGINT);",
          },
        ],
        [],
      ),
    ).toThrow();
  });

  it.each([
    "../0001_members.sql",
    "0001_members.txt",
    "000A_members.sql",
    "0001_ members.sql",
  ])("refuse un nom de fichier invalide : %s", (name) => {
    expect(() =>
      planMigrations([{ ...first, name }], []),
    ).toThrow();
  });

  it("refuse une migration vide", () => {
    expect(() =>
      planMigrations([{ ...first, sql: " \n " }], []),
    ).toThrow();
  });
});