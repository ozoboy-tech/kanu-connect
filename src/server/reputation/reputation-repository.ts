import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { calculateAwardedPoints } from "@/modules/reputation/domain/calculate-awarded-points";
import { ACTION_POINTS, badgesForPoints, type ReputationAction } from
  "@/modules/reputation/domain/reputation-rules";

interface DayRow extends RowDataPacket { points: number }
interface ScoreRow extends RowDataPacket { points: number | string }
interface RankRow extends RowDataPacket {
  handle: string;
  points: number | string;
  votes: number | string;
}


// Le code appelant doit être dans la même transaction que la création de la source.
export async function awardActivity(
  connection: PoolConnection, memberId: number,
  action: ReputationAction, sourceId: number,
): Promise<number> {
  if (!Number.isSafeInteger(memberId) || memberId <= 0 ||
      !Number.isSafeInteger(sourceId) || sourceId <= 0) {
    throw new RangeError("Identifiant d'activité invalide.");
  }
  await connection.execute(
    `INSERT INTO member_reputation_days (member_id, day_utc, points)
     VALUES (?, UTC_DATE(), 0)
     ON DUPLICATE KEY UPDATE member_id = member_id`,
    [memberId],
  );
  const [days] = await connection.execute<DayRow[]>(
    `SELECT points FROM member_reputation_days
     WHERE member_id = ? AND day_utc = UTC_DATE() FOR UPDATE`,
    [memberId],
  );
  const [events] = await connection.execute<RowDataPacket[]>(
    `SELECT id FROM member_reputation_events
     WHERE member_id = ? AND action = ? AND source_id = ? LIMIT 1`,
    [memberId, action, sourceId],
  );
  if (events.length) return 0;
  const awarded = calculateAwardedPoints(ACTION_POINTS[action], days[0].points);
  await connection.execute(
    `INSERT INTO member_reputation_events
     (member_id, action, source_id, points, awarded_at)
     VALUES (?, ?, ?, ?, UTC_TIMESTAMP(3))`,
    [memberId, action, sourceId, awarded],
  );
  if (awarded) {
    await connection.execute<ResultSetHeader>(
      `UPDATE member_reputation_days SET points = points + ?
       WHERE member_id = ? AND day_utc = UTC_DATE()`,
      [awarded, memberId],
    );
  }
  return awarded;
}

export interface ReputationSummary { points: number; badges: string[] }

export async function getReputation(
  connection: PoolConnection, handle: string,
): Promise<ReputationSummary | null> {
  const [rows] = await connection.execute<ScoreRow[]>(
    `SELECT COALESCE(SUM(e.points), 0) AS points
     FROM member_profiles p
     LEFT JOIN member_reputation_events e ON e.member_id = p.member_id
     WHERE p.handle = ? GROUP BY p.member_id`, [handle],
  );
  if (!rows.length) return null;
  const points = Number(rows[0].points);
  return { points, badges: badgesForPoints(points) };
}

export async function listLeaderboard(
  connection: PoolConnection, period: "all" | "week",
): Promise<{ handle: string; points: number; votes: number }[]> {
  const filter = period === "week"
    ? "AND e.awarded_at >= UTC_TIMESTAMP(3) - INTERVAL 7 DAY" : "";
  const voteFilter = period === "week"
    ? "AND v.updated_at >= UTC_TIMESTAMP(3) - INTERVAL 7 DAY" : "";
  const [rows] = await connection.execute<RankRow[]>(
    `SELECT p.handle, COALESCE(SUM(e.points), 0) AS points,
       (SELECT COUNT(*) FROM post_votes v
        JOIN posts post ON post.id = v.post_id
        WHERE post.member_id = p.member_id AND post.deleted_at IS NULL
          AND v.active = 1 ${voteFilter}) +
       (SELECT COUNT(*) FROM comment_votes v
        JOIN post_comments c ON c.id = v.comment_id
        JOIN posts parent ON parent.id = c.post_id
        WHERE c.member_id = p.member_id AND c.deleted_at IS NULL
          AND parent.deleted_at IS NULL AND v.active = 1 ${voteFilter}) +
       (SELECT COUNT(*) FROM project_votes v
        JOIN member_projects project ON project.id = v.project_id
        WHERE project.member_id = p.member_id
          AND project.deleted_at IS NULL
          AND v.active = 1 ${voteFilter}) AS votes
     FROM member_profiles p
     LEFT JOIN member_reputation_events e
       ON e.member_id = p.member_id ${filter}
     GROUP BY p.member_id, p.handle
     ORDER BY points DESC, votes DESC, p.handle ASC LIMIT 50`,
  );
  return rows.map((row) => ({
    handle: row.handle,
    points: Number(row.points),
    votes: Number(row.votes),
  }));
}

