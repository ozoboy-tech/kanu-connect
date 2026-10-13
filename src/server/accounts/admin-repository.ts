import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import type { AccountRole } from "./account-repository";
import { isAdmin } from "@/server/moderation/moderator";

export type AdminAction =
  | { action: "suspend" | "restore"; reason: string }
  | { action: "role"; role: AccountRole; reason: string };

export function parseAdminAction(input: Record<string, unknown>): AdminAction {
  if (typeof input.reason !== "string" ||
      input.reason.trim().length < 5 || input.reason.trim().length > 500) {
    throw new TypeError("Motif invalide.");
  }
  if (input.action === "suspend" || input.action === "restore") {
    return { action: input.action, reason: input.reason.trim() };
  }
  if (input.action === "role" &&
      ["member", "moderator", "admin"].includes(String(input.role))) {
    return { action: "role", role: input.role as AccountRole,
      reason: input.reason.trim() };
  }
  throw new TypeError("Action invalide.");
}

export async function administerAccount(
  connection: PoolConnection, actorPublicId: string, targetPublicId: string,
  input: AdminAction,
): Promise<"ok" | "not_found" | "forbidden"> {
  if (actorPublicId === targetPublicId || !await isAdmin(connection, actorPublicId)) {
    return "forbidden";
  }
  await connection.beginTransaction();
  try {
    const [rows] = await connection.execute<(RowDataPacket & {
      id: number; publicId: string; role: AccountRole; status: string;
    })[]>(
      `SELECT id, public_id AS publicId, account_role AS role,
              account_status AS status FROM members
       WHERE public_id IN (?, ?) ORDER BY id FOR UPDATE`,
      [actorPublicId, targetPublicId],
    );
    const actor = rows.find((row) => row.publicId === actorPublicId);
    const target = rows.find((row) => row.publicId === targetPublicId);
    if (!actor || actor.status !== "active" || !target || target.status === "deleted") {
      await connection.rollback(); return "not_found";
    }
    // Les comptes administrateurs sont protégés contre une révocation accidentelle.
    if (target.role === "admin" || await isAdmin(connection, targetPublicId) ||
        (input.action === "restore" && target.status !== "suspended") ||
        (input.action === "suspend" && target.status !== "active") ||
        (input.action === "role" && target.status !== "active")) {
      await connection.rollback(); return "forbidden";
    }
    if (input.action === "role") {
      await connection.execute(
        "UPDATE members SET account_role = ?, updated_at = UTC_TIMESTAMP(3) WHERE id = ?",
        [input.role, target.id],
      );
    } else {
      await connection.execute(
        `UPDATE members SET account_status = ?, suspension_reason = ?,
                updated_at = UTC_TIMESTAMP(3) WHERE id = ?`,
        [input.action === "suspend" ? "suspended" : "active",
         input.action === "suspend" ? input.reason : null, target.id],
      );
      if (input.action === "suspend") await connection.execute(
        "DELETE FROM member_sessions WHERE member_id = ?", [target.id],
      );
    }
    await connection.execute(
      `INSERT INTO account_admin_audit (target_id, actor_id, action, reason, created_at)
       VALUES (?, ?, ?, ?, UTC_TIMESTAMP(3))`,
      [target.id, actor.id, input.action, input.reason],
    );
    await connection.commit(); return "ok";
  } catch (error) { await connection.rollback(); throw error; }
}

export async function listAdminMembers(
  connection: PoolConnection, actorPublicId: string,
): Promise<{ id: string; handle: string; status: string; role: AccountRole;
            reason: string | null }[]> {
  if (!await isAdmin(connection, actorPublicId)) throw new Error("Accès refusé.");
  const [rows] = await connection.execute<(RowDataPacket & {
    id: string; handle: string; status: string; role: AccountRole; reason: string | null;
  })[]>(
    `SELECT m.public_id AS id, p.handle, m.account_status AS status,
            m.account_role AS role, m.suspension_reason AS reason
     FROM members m JOIN member_profiles p ON p.member_id = m.id
     WHERE m.account_status <> 'deleted'
     ORDER BY m.created_at DESC LIMIT 100`,
  );
  const bootstrappedAdmins = new Set((process.env.KANU_ADMIN_IDS ?? "")
    .split(",").map((id) => id.trim()).filter(Boolean));
  return rows.map(({ id, handle, status, role, reason }) =>
    ({ id, handle, status,
      role: bootstrappedAdmins.has(id) ? "admin" as const : role, reason }));
}
