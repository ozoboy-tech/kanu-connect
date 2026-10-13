import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import type { AccountRole } from "@/server/accounts/account-repository";

function inConfiguredIds(name: string, publicId: string): boolean {
  return (process.env[name] ?? "").split(",").some((id) =>
    id.trim() !== "" && id.trim() === publicId);
}

export function isModerator(
  memberId: string | undefined,
): boolean {
  if (!memberId) return false;

  return (process.env.KANU_MODERATOR_IDS ?? "")
    .split(",")
    .map((id) => id.trim())
    .some((id) => id !== "" && id === memberId);
}

export async function roleOf(
  connection: PoolConnection, publicId: string,
): Promise<AccountRole | null> {
  const [rows] = await connection.execute<(RowDataPacket & {
    role: AccountRole; status: string;
  })[]>(
    `SELECT account_role AS role, account_status AS status
     FROM members WHERE public_id = ? LIMIT 1`, [publicId],
  );
  if (!rows[0] || rows[0].status !== "active") return null;
  if (inConfiguredIds("KANU_ADMIN_IDS", publicId)) return "admin";
  if (rows[0].role === "member" && isModerator(publicId)) return "moderator";
  return rows[0].role;
}

export async function canModerate(
  connection: PoolConnection, publicId: string,
): Promise<boolean> {
  const role = await roleOf(connection, publicId);
  return role === "moderator" || role === "admin";
}

export async function isAdmin(
  connection: PoolConnection, publicId: string,
): Promise<boolean> {
  return await roleOf(connection, publicId) === "admin";
}
