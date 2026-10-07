import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { awardActivity } from "@/server/reputation/reputation-repository";


interface MemberRow extends RowDataPacket {
  id: number;
}

interface StatsRow extends RowDataPacket {
  followerCount: number;
  followingCount: number;
  isFollowing: number;
}

interface ConnectionRow extends RowDataPacket {
  handle: string;
}

export interface FollowStats {
  followerCount: number;
  followingCount: number;
  isFollowing: boolean;
}

export async function getFollowStats(
  connection: PoolConnection, handle: string, viewerId: string | null,
): Promise<FollowStats | null> {
  const [rows] = await connection.execute<StatsRow[]>(
    `SELECT
       (SELECT COUNT(*) FROM member_follows f
        WHERE f.followed_id = target.id) AS followerCount,
       (SELECT COUNT(*) FROM member_follows f
        WHERE f.follower_id = target.id) AS followingCount,
       EXISTS (
         SELECT 1 FROM member_follows f
         JOIN members viewer ON viewer.id = f.follower_id
         WHERE f.followed_id = target.id AND viewer.public_id = ?
       ) AS isFollowing
     FROM member_profiles profile
     JOIN members target ON target.id = profile.member_id
     WHERE profile.handle = ? LIMIT 1`,
    [viewerId, handle],
  );
  return rows[0] ? {
    followerCount: rows[0].followerCount,
    followingCount: rows[0].followingCount,
    isFollowing: rows[0].isFollowing === 1,
  } : null;
}

export type FollowMutation = "ok" | "not_found" | "self";

export async function setFollow(
  connection: PoolConnection, handle: string, viewerId: string, follow: boolean,
): Promise<FollowMutation> {
  const [targets] = await connection.execute<MemberRow[]>(
    `SELECT m.id FROM member_profiles profile
     JOIN members m ON m.id = profile.member_id
     WHERE profile.handle = ? LIMIT 1`, [handle],
  );
  const [viewers] = await connection.execute<MemberRow[]>(
    `SELECT id FROM members WHERE public_id = ? LIMIT 1`, [viewerId],
  );
  if (!targets[0] || !viewers[0]) return "not_found";
  if (targets[0].id === viewers[0].id) return "self";
  await connection.beginTransaction();
  try {
    if (follow) {
      const [result] = await connection.execute<ResultSetHeader>(
        `INSERT INTO member_follows (follower_id, followed_id, created_at)
         VALUES (?, ?, UTC_TIMESTAMP(3))
         ON DUPLICATE KEY UPDATE followed_id = followed_id`,
        [viewers[0].id, targets[0].id],
      );
      if (result.affectedRows === 1) {
        await awardActivity(connection, viewers[0].id, "follow", targets[0].id);
      }
    } else {
      await connection.execute(
        `DELETE FROM member_follows WHERE follower_id = ? AND followed_id = ?`,
        [viewers[0].id, targets[0].id],
      );
    }
    await connection.commit();
  } catch (error) { await connection.rollback(); throw error; }
  return "ok";
}


export async function listConnections(
  connection: PoolConnection, handle: string,
  kind: "followers" | "following",
): Promise<string[]> {
  const ownerColumn = kind === "followers" ? "followed_id" : "follower_id";
  const peerColumn = kind === "followers" ? "follower_id" : "followed_id";
  const [rows] = await connection.execute<ConnectionRow[]>(
    `SELECT peer.handle FROM member_follows f
     JOIN member_profiles owner ON owner.member_id = f.${ownerColumn}
     JOIN member_profiles peer ON peer.member_id = f.${peerColumn}
     WHERE owner.handle = ?
     ORDER BY f.created_at DESC, f.${peerColumn} DESC LIMIT 50`, [handle],
  );
  return rows.map((row) => row.handle);
}
