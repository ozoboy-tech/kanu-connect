import type { PoolConnection, RowDataPacket } from "mysql2/promise";

type IdRow = RowDataPacket & { id: number };

/** SQL à utiliser avec un alias d'auteur déjà présent ; la valeur est l'ID public du lecteur. */
export function visibleToViewerSql(authorAlias: string): string {
  return `(? IS NULL OR NOT EXISTS (
    SELECT 1 FROM member_blocks block_record
    JOIN members viewer ON viewer.public_id = ?
    WHERE (block_record.blocker_id = viewer.id AND block_record.blocked_id = ${authorAlias})
       OR (block_record.blocked_id = viewer.id AND block_record.blocker_id = ${authorAlias})
  ))`;
}

export async function areBlocked(
  connection: PoolConnection, firstPublicId: string, secondPublicId: string,
): Promise<boolean> {
  const [rows] = await connection.execute<IdRow[]>(
    `SELECT 1 AS id FROM member_blocks b
     JOIN members a ON a.id = b.blocker_id
     JOIN members peer ON peer.id = b.blocked_id
     WHERE (a.public_id = ? AND peer.public_id = ?)
        OR (a.public_id = ? AND peer.public_id = ?) LIMIT 1`,
    [firstPublicId, secondPublicId, secondPublicId, firstPublicId],
  );
  return rows.length > 0;
}

export async function blockState(
  connection: PoolConnection, viewerId: string, handle: string,
): Promise<{ blockedByMe: boolean; blockedMe: boolean } | null> {
  const [rows] = await connection.execute<(RowDataPacket & {
    blockedByMe: number; blockedMe: number;
  })[]>(
    `SELECT EXISTS (SELECT 1 FROM member_blocks b
         WHERE b.blocker_id = viewer.id AND b.blocked_id = target.id) AS blockedByMe,
       EXISTS (SELECT 1 FROM member_blocks b
         WHERE b.blocker_id = target.id AND b.blocked_id = viewer.id) AS blockedMe
     FROM members viewer JOIN member_profiles p ON p.handle = ?
     JOIN members target ON target.id = p.member_id
     WHERE viewer.public_id = ? AND viewer.account_status = 'active'
       AND target.account_status <> 'deleted' AND target.id <> viewer.id LIMIT 1`,
    [handle, viewerId],
  );
  return rows[0] ? {
    blockedByMe: rows[0].blockedByMe === 1,
    blockedMe: rows[0].blockedMe === 1,
  } : null;
}

export async function setBlock(
  connection: PoolConnection, viewerId: string, handle: string, block: boolean,
): Promise<"ok" | "not_found" | "self"> {
  await connection.beginTransaction();
  try {
    const [rows] = await connection.execute<(RowDataPacket & {
      id: number; publicId: string; status: string;
    })[]>(
      `SELECT m.id, m.public_id AS publicId, m.account_status AS status
       FROM members m LEFT JOIN member_profiles p ON p.member_id = m.id
       WHERE m.public_id = ? OR p.handle = ? ORDER BY m.id FOR UPDATE`,
      [viewerId, handle],
    );
    const viewer = rows.find((row) => row.publicId === viewerId);
    const [targets] = await connection.execute<(IdRow & { status: string })[]>(
      `SELECT m.id, m.account_status AS status FROM members m
       JOIN member_profiles p ON p.member_id = m.id
       WHERE p.handle = ? AND m.account_status <> 'deleted'`, [handle],
    );
    const target = targets[0];
    if (!viewer || viewer.status !== "active" || !target ||
        (block && target.status !== "active")) {
      await connection.rollback(); return "not_found";
    }
    if (target.id === viewer.id) {
      await connection.rollback(); return "self";
    }
    if (block) {
      await connection.execute(
        `INSERT INTO member_blocks (blocker_id, blocked_id, created_at)
         VALUES (?, ?, UTC_TIMESTAMP(3))
         ON DUPLICATE KEY UPDATE blocked_id = blocked_id`, [viewer.id, target.id],
      );
      await connection.execute(
        `DELETE FROM member_follows
         WHERE (follower_id = ? AND followed_id = ?)
            OR (follower_id = ? AND followed_id = ?)`,
        [viewer.id, target.id, target.id, viewer.id],
      );
    } else {
      await connection.execute(
        "DELETE FROM member_blocks WHERE blocker_id = ? AND blocked_id = ?",
        [viewer.id, target.id],
      );
    }
    await connection.commit(); return "ok";
  } catch (error) { await connection.rollback(); throw error; }
}

export async function listMyBlocks(
  connection: PoolConnection, viewerId: string,
): Promise<string[]> {
  const [rows] = await connection.execute<(RowDataPacket & { handle: string })[]>(
    `SELECT p.handle FROM member_blocks b
     JOIN members me ON me.id = b.blocker_id
     JOIN member_profiles p ON p.member_id = b.blocked_id
     WHERE me.public_id = ? ORDER BY b.created_at DESC LIMIT 100`, [viewerId],
  );
  return rows.map((row) => row.handle);
}
