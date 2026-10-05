import { expect, it } from "vitest";

import { checkDatabaseConnection } from
  "@/server/database/check-database-connection";
import { parseDatabaseUrl } from
  "@/server/database/parse-database-url";

it("se connecte à la base de test avec le compte prévu", async () => {
  const password = process.env.KANU_TEST_DB_PASSWORD;

  if (!password) {
    throw new Error("Le mot de passe MySQL de test est absent.");
  }

  const url =
    `mysql://kanu_app_test:${encodeURIComponent(password)}` +
    "@127.0.0.1:3306/kanuconnecttest";

  const config = parseDatabaseUrl(url, "kanuconnecttest");
  const result = await checkDatabaseConnection(config);

  expect(result.database).toBe("kanuconnecttest");
  expect(result.authenticatedUser).toBe(
    "kanu_app_test@127.0.0.1",
  );
});