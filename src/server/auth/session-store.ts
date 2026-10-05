import { createHash, randomBytes } from "node:crypto";
import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";

export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

interface SessionRow extends RowDataPacket {
  publicId: string;
  onboarded: number;
}

export async function startSession(
  connection: PoolConnection,
  memberPublicId: string,
): Promise<string> {
  const secret = randomBytes(32).toString("hex");
  const [insert] = await connection.execute<ResultSetHeader>(
    `INSERT INTO member_sessions
       (token_hash, member_id, created_at, last_seen_at, expires_at)
     SELECT ?, id, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3),
            UTC_TIMESTAMP(3) + INTERVAL 30 DAY
     FROM members WHERE public_id = ?`,
    [hashToken(secret), memberPublicId],
  );
  if (insert.affectedRows !== 1) throw new Error("Compte introuvable.");
  return secret;
}

export async function touchSession(
  connection: PoolConnection,
  secret: string,
): Promise<{ publicId: string; onboarded: boolean } | null> {
  const [rows] = await connection.execute<SessionRow[]>(
    `SELECT m.public_id AS publicId,
            (p.member_id IS NOT NULL AND i.member_id IS NOT NULL) AS onboarded
     FROM member_sessions s
     JOIN members m ON m.id = s.member_id
     LEFT JOIN member_profiles p ON p.member_id = m.id
     LEFT JOIN member_private_identities i ON i.member_id = m.id
     WHERE s.token_hash = ?
       AND s.expires_at > UTC_TIMESTAMP(3)
       AND s.last_seen_at > UTC_TIMESTAMP(3) - INTERVAL 7 DAY`,
    [hashToken(secret)],
  );
  if (!rows[0]) return null;
  const [updated] = await connection.execute<ResultSetHeader>(
    `UPDATE member_sessions SET last_seen_at = UTC_TIMESTAMP(3)
     WHERE token_hash = ? AND expires_at > UTC_TIMESTAMP(3)
       AND last_seen_at > UTC_TIMESTAMP(3) - INTERVAL 7 DAY`,
    [hashToken(secret)],
  );
  if (updated.affectedRows !== 1) return null;
  return { publicId: rows[0].publicId, onboarded: rows[0].onboarded === 1 };
}

export async function revokeSession(
  connection: PoolConnection,
  secret: string,
): Promise<void> {
  await connection.execute(
    "DELETE FROM member_sessions WHERE token_hash = ?",
    [hashToken(secret)],
  );
}
