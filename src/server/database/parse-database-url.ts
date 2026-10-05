export interface DatabaseConnectionConfig {
  readonly host: string;
  readonly port: number;
  readonly user: string;
  readonly password: string;
  readonly database: string;
}

export function parseDatabaseUrl(
  rawUrl: string | undefined,
  expectedDatabase: string,
): DatabaseConnectionConfig {
  const invalidConfiguration = (): TypeError =>
    new TypeError("Configuration MySQL invalide.");

  if (
    !rawUrl ||
    rawUrl !== rawUrl.trim() ||
    !/^[a-zA-Z0-9_]+$/.test(expectedDatabase)
  ) {
    throw invalidConfiguration();
  }

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(rawUrl);
  } catch {
    throw invalidConfiguration();
  }

  if (
    parsedUrl.protocol !== "mysql:" ||
    !parsedUrl.hostname ||
    !parsedUrl.username ||
    !parsedUrl.password ||
    parsedUrl.search ||
    parsedUrl.hash
  ) {
    throw invalidConfiguration();
  }

  let user: string;
  let password: string;
  let database: string;

  try {
    user = decodeURIComponent(parsedUrl.username);
    password = decodeURIComponent(parsedUrl.password);
    database = decodeURIComponent(parsedUrl.pathname.slice(1));
  } catch {
    throw invalidConfiguration();
  }

  if (
    !user ||
    !password ||
    database !== expectedDatabase ||
    user.toLowerCase() === "root" ||
    /^kanu_migrate_/i.test(user)
  ) {
    throw invalidConfiguration();
  }

  const port = parsedUrl.port ? Number(parsedUrl.port) : 3306;

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw invalidConfiguration();
  }

  const hostname = parsedUrl.hostname;
  const host =
    hostname.startsWith("[") && hostname.endsWith("]")
      ? hostname.slice(1, -1)
      : hostname;

  return {
    host,
    port,
    user,
    password,
    database,
  };
}