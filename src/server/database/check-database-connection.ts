import { createConnection, type RowDataPacket } from "mysql2/promise";

import type { DatabaseConnectionConfig } from
  "./parse-database-url";

export interface DatabaseConnectionStatus {
  readonly database: string;
  readonly authenticatedUser: string;
}

interface DatabaseIdentityRow extends RowDataPacket {
  databaseName: string | null;
  authenticatedUser: string;
}

export async function checkDatabaseConnection(
  config: DatabaseConnectionConfig,
): Promise<DatabaseConnectionStatus> {
  const connection = await createConnection({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    charset: "utf8mb4",
    timezone: "Z",
    connectTimeout: 5_000,
    multipleStatements: false,
  });

  try {
    const [rows] = await connection.query<DatabaseIdentityRow[]>({
      sql: `
        SELECT
          DATABASE() AS databaseName,
          CURRENT_USER() AS authenticatedUser
      `,
      timeout: 3_000,
    });

    const identity = rows[0];

    if (
      !identity ||
      identity.databaseName !== config.database ||
      typeof identity.authenticatedUser !== "string"
    ) {
      throw new Error("MySQL n'a pas retourné l'identité attendue.");
    }

    return {
      database: identity.databaseName,
      authenticatedUser: identity.authenticatedUser,
    };
  } finally {
    await connection.end();
  }
}