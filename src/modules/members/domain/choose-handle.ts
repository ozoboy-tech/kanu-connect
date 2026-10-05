import { randomBytes } from "node:crypto";
import type { Connection, RowDataPacket } from "mysql2/promise";

const handlePattern = /^[a-z0-9_]{3,30}$/;

export function normalizeHandle(input: string): string {
  const handle = input.trim().toLowerCase();

  if (!handlePattern.test(handle)) {
    throw new TypeError(
      "Pseudo invalide : 3 à 30 lettres, chiffres ou _.",
    );
  }

  return handle;
}

export async function isHandleAvailable(
  connection: Pick<Connection, "execute">,
  input: string,
): Promise<boolean> {
  const handle = normalizeHandle(input);
  const [rows] = await connection.execute<RowDataPacket[]>(
    "SELECT 1 AS present FROM member_profiles WHERE handle = ? LIMIT 1",
    [handle],
  );

  return rows.length === 0;
}

export async function chooseHandle(
  connection: Pick<Connection, "execute">,
  requested: string | null,
  createSuffix: () => string = () => randomBytes(6).toString("hex"),
): Promise<string> {
  if (requested?.trim()) {
    const handle = normalizeHandle(requested);

    if (!await isHandleAvailable(connection, handle)) {
      throw new Error("Pseudo indisponible.");
    }

    return handle;
  }

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const candidate = normalizeHandle(`kanu_${createSuffix()}`);

    if (await isHandleAvailable(connection, candidate)) {
      return candidate;
    }
  }

  throw new Error("Aucun pseudo disponible.");
}