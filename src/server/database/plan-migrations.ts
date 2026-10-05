import { createHash } from "node:crypto";

export interface MigrationFile {
  readonly name: string;
  readonly sql: string;
}

export interface AppliedMigration {
  readonly name: string;
  readonly checksum: string;
}

export interface PendingMigration extends MigrationFile {
  readonly checksum: string;
}

const filenamePattern = /^(\d{4})_[a-z0-9][a-z0-9_-]*\.sql$/;

function checksumOf(sql: string): string {
  return createHash("sha256")
    .update(sql, "utf8")
    .digest("hex");
}

export function planMigrations(
  files: readonly MigrationFile[],
  applied: readonly AppliedMigration[],
): PendingMigration[] {
  const versions = new Set<string>();

  const ordered = files.map((file): PendingMigration => {
    if (file.name.length > 128) {
      throw new TypeError("Nom de migration trop long.");
    }

    const match = filenamePattern.exec(file.name);

    if (!match || !file.sql.trim()) {
      throw new TypeError("Fichier de migration invalide.");
    }

    const version = match[1];

    if (versions.has(version)) {
      throw new Error("Numéro de migration dupliqué.");
    }

    versions.add(version);

    const normalizedSql = file.sql.replace(/\r\n/g, "\n");

    return {
      name: file.name,
      sql: file.sql,
      checksum: checksumOf(normalizedSql),
    };
  });

  ordered.sort((left, right) =>
    left.name.localeCompare(right.name, "en"),
  );

  const appliedNames = new Set<string>();
  const appliedInOrder = [...applied].sort((left, right) =>
    left.name.localeCompare(right.name, "en"),
  );

  for (const [index, record] of appliedInOrder.entries()) {
    if (appliedNames.has(record.name)) {
      throw new Error("Historique de migrations dupliqué.");
    }

    appliedNames.add(record.name);

    const expected = ordered[index];

    if (!expected || expected.name !== record.name) {
      throw new Error("Historique de migrations incomplet ou inconnu.");
    }

    // Compatibilité avec les empreintes calculées auparavant
    // sur un fichier Windows dont les lignes étaient en CRLF.
    const legacyCrLfChecksum = checksumOf(
      expected.sql.replace(/\r?\n/g, "\r\n"),
    );

    if (
      record.checksum !== expected.checksum &&
      record.checksum !== legacyCrLfChecksum
    ) {
      throw new Error("Empreinte de migration modifiée.");
    }
  }

  return ordered.slice(appliedInOrder.length);
}
