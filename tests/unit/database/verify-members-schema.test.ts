import { describe, expect, it } from "vitest";

import {
  verifyMembersSchema,
  type MembersSchemaMetadata,
} from "@/server/database/verify-members-schema";

const valid: MembersSchemaMetadata = {
  engine: "InnoDB",
  tableCollation: "utf8mb4_0900_ai_ci",
  columns: [
    { name: "id", columnType: "bigint unsigned", isNullable: "NO", extra: "auto_increment", collationName: null, defaultValue: null, generationExpression: "" },
    { name: "public_id", columnType: "char(36)", isNullable: "NO", extra: "", collationName: "ascii_bin", defaultValue: null, generationExpression: "" },
    { name: "created_at", columnType: "datetime(3)", isNullable: "NO", extra: "", collationName: null, defaultValue: null, generationExpression: "" },
    { name: "updated_at", columnType: "datetime(3)", isNullable: "NO", extra: "", collationName: null, defaultValue: null, generationExpression: "" },
  ],
  indexes: [
    { name: "PRIMARY", unique: true, columns: ["id"] },
    { name: "uq_members_public_id", unique: true, columns: ["public_id"] },
  ],
};

describe("Vérification stricte de la table members", () => {
  it("accepte la structure attendue", () => {
    expect(verifyMembersSchema(valid)).toBe(true);
  });

  it("rejette un moteur ou une collation différente", () => {
    expect(verifyMembersSchema({ ...valid, engine: "MyISAM" })).toBe(false);
    expect(verifyMembersSchema({ ...valid, tableCollation: "utf8mb4_general_ci" })).toBe(false);
  });

  it("rejette une colonne manquante ou ajoutée", () => {
    expect(verifyMembersSchema({ ...valid, columns: valid.columns.slice(1) })).toBe(false);
    expect(verifyMembersSchema({ ...valid, columns: [...valid.columns, { ...valid.columns[0], name: "secret" }] })).toBe(false);
  });

  it("rejette un identifiant sans incrémentation automatique", () => {
    expect(verifyMembersSchema({ ...valid, columns: [{ ...valid.columns[0], extra: "" }, ...valid.columns.slice(1)] })).toBe(false);
  });

  it("rejette un identifiant public non unique", () => {
    expect(verifyMembersSchema({ ...valid, indexes: [valid.indexes[0], { ...valid.indexes[1], unique: false }] })).toBe(false);
  });

  it("rejette une clé ou une collation de public_id différente", () => {
    expect(verifyMembersSchema({ ...valid, indexes: [{ ...valid.indexes[0], columns: ["public_id"] }, valid.indexes[1]] })).toBe(false);
    expect(verifyMembersSchema({ ...valid, columns: [valid.columns[0], { ...valid.columns[1], collationName: "ascii_general_ci" }, ...valid.columns.slice(2)] })).toBe(false);
  });

  it("rejette une valeur par défaut ou une colonne calculée inattendue", () => {
    expect(verifyMembersSchema({ ...valid, columns: [{ ...valid.columns[0], defaultValue: "1" }, ...valid.columns.slice(1)] })).toBe(false);
    expect(verifyMembersSchema({ ...valid, columns: [valid.columns[0], { ...valid.columns[1], generationExpression: "UUID()" }, ...valid.columns.slice(2)] })).toBe(false);
  });
});
