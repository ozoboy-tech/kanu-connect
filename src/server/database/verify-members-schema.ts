import type { Connection, RowDataPacket } from "mysql2/promise";

export interface MembersColumn {
  readonly name: string;
  readonly columnType: string;
  readonly isNullable: string;
  readonly extra: string;
  readonly collationName: string | null;
  readonly defaultValue: string | null;
  readonly generationExpression: string;
}

export interface MembersIndex {
  readonly name: string;
  readonly unique: boolean;
  readonly columns: readonly string[];
}

export interface MembersSchemaMetadata {
  readonly engine: string;
  readonly tableCollation: string;
  readonly columns: readonly MembersColumn[];
  readonly indexes: readonly MembersIndex[];
}

const expectedColumns: readonly MembersColumn[] = [
  { name: "id", columnType: "bigint unsigned", isNullable: "NO", extra: "auto_increment", collationName: null, defaultValue: null, generationExpression: "" },
  { name: "public_id", columnType: "char(36)", isNullable: "NO", extra: "", collationName: "ascii_bin", defaultValue: null, generationExpression: "" },
  { name: "created_at", columnType: "datetime(3)", isNullable: "NO", extra: "", collationName: null, defaultValue: null, generationExpression: "" },
  { name: "updated_at", columnType: "datetime(3)", isNullable: "NO", extra: "", collationName: null, defaultValue: null, generationExpression: "" },
];

const expectedIndexes: readonly MembersIndex[] = [
  { name: "PRIMARY", unique: true, columns: ["id"] },
  { name: "uq_members_public_id", unique: true, columns: ["public_id"] },
];

export function verifyMembersSchema(metadata: MembersSchemaMetadata): boolean {
  if (metadata.engine !== "InnoDB" ||
      metadata.tableCollation !== "utf8mb4_0900_ai_ci" ||
      metadata.columns.length !== expectedColumns.length ||
      metadata.indexes.length !== expectedIndexes.length) {
    return false;
  }

  const sameColumn = (actual: MembersColumn, expected: MembersColumn) =>
    actual.name === expected.name &&
    actual.columnType === expected.columnType &&
    actual.isNullable === expected.isNullable &&
    actual.extra === expected.extra &&
    actual.collationName === expected.collationName &&
    actual.defaultValue === expected.defaultValue &&
    actual.generationExpression === expected.generationExpression;

  const sameIndex = (actual: MembersIndex, expected: MembersIndex) =>
    actual.name === expected.name &&
    actual.unique === expected.unique &&
    actual.columns.length === expected.columns.length &&
    actual.columns.every((column, index) => column === expected.columns[index]);

  return expectedColumns.every((expected, index) =>
    sameColumn(metadata.columns[index], expected)) &&
    expectedIndexes.every((expected) =>
      metadata.indexes.some((actual) => sameIndex(actual, expected)));
}

interface TableRow extends RowDataPacket {
  engine: string;
  tableCollation: string;
}

interface ColumnRow extends RowDataPacket, MembersColumn {}

interface IndexRow extends RowDataPacket {
  name: string;
  nonUnique: number;
  columnName: string | null;
}

export async function inspectMembersSchema(connection: Connection): Promise<boolean> {
  const [tables] = await connection.query<TableRow[]>(`
    SELECT ENGINE AS engine, TABLE_COLLATION AS tableCollation
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'members'
      AND TABLE_TYPE = 'BASE TABLE'
  `);

  if (tables.length !== 1) return false;

  const [columns] = await connection.query<ColumnRow[]>(`
    SELECT COLUMN_NAME AS name, COLUMN_TYPE AS columnType,
           IS_NULLABLE AS isNullable, EXTRA AS extra,
           COLLATION_NAME AS collationName,
           COLUMN_DEFAULT AS defaultValue,
           GENERATION_EXPRESSION AS generationExpression
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'members'
    ORDER BY ORDINAL_POSITION
  `);

  const [indexRows] = await connection.query<IndexRow[]>(`
    SELECT INDEX_NAME AS name, NON_UNIQUE AS nonUnique,
           COLUMN_NAME AS columnName
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'members'
    ORDER BY INDEX_NAME, SEQ_IN_INDEX
  `);

  const byName = new Map<string, { name: string; unique: boolean; columns: string[] }>();

  for (const row of indexRows) {
    if (row.columnName === null) return false;
    const index = byName.get(row.name);
    if (index) {
      if (index.unique !== (row.nonUnique === 0)) return false;
      index.columns.push(row.columnName);
    } else {
      byName.set(row.name, {
        name: row.name,
        unique: row.nonUnique === 0,
        columns: [row.columnName],
      });
    }
  }

  return verifyMembersSchema({
    engine: tables[0].engine,
    tableCollation: tables[0].tableCollation,
    columns,
    indexes: [...byName.values()],
  });
}
