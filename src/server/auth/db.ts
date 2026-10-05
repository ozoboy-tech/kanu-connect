import mysql, { type Pool } from "mysql2/promise";

import { parseDatabaseUrl } from "@/server/database/parse-database-url";

let pool: Pool | undefined;

export function authPool(): Pool {
  if (!pool) {
    const target = process.env.KANU_DATABASE_NAME;
    if (target !== "kanuconnectdev" && target !== "kanuconnecttest") {
      throw new TypeError("Base d'application non configurée.");
    }
    const config = parseDatabaseUrl(process.env.KANU_DATABASE_URL, target);
    if (config.user !== (target === "kanuconnecttest"
      ? "kanu_app_test" : "kanu_app_dev")) {
      throw new TypeError("Compte d'application MySQL inattendu.");
    }
    pool = mysql.createPool({
      ...config,
      charset: "utf8mb4",
      timezone: "Z",
      connectionLimit: 5,
      multipleStatements: false,
    });
  }
  return pool;
}
