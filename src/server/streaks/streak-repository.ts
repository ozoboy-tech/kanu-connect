import type { PoolConnection, RowDataPacket } from "mysql2/promise";

import { advanceStreak, visibleStreak } from "@/modules/streaks/domain/advance-streak";
import { awardActivity } from "@/server/reputation/reputation-repository";

interface DayRow extends RowDataPacket { today: string }
interface StreakRow extends RowDataPacket {
  currentDays: number;
  bestDays: number;
  lastDay: string | null;
}
interface PublicRow extends StreakRow { today: string }

// Appeler dans la transaction de création, après les points de l'activité.
export async function recordUsefulActivity(
  connection: PoolConnection, memberId: number,
): Promise<void> {
  const [days] = await connection.execute<DayRow[]>(
    "SELECT DATE_FORMAT(UTC_DATE(), '%Y-%m-%d') AS today",
  );
  const today = days[0].today;
  await connection.execute(
    `INSERT INTO member_streaks (member_id, current_days, best_days, last_active_day)
     VALUES (?, 0, 0, NULL) ON DUPLICATE KEY UPDATE member_id = member_id`,
    [memberId],
  );
  const [rows] = await connection.execute<StreakRow[]>(
    `SELECT current_days AS currentDays, best_days AS bestDays,
            DATE_FORMAT(last_active_day, '%Y-%m-%d') AS lastDay
     FROM member_streaks WHERE member_id = ? FOR UPDATE`, [memberId],
  );
  const previous = rows[0];
  const next = advanceStreak(previous, today);
  if (next.lastDay === previous.lastDay) return;
  await connection.execute(
    "INSERT INTO member_streak_days (member_id, day_utc) VALUES (?, ?)",
    [memberId, today],
  );
  await connection.execute(
    `UPDATE member_streaks SET current_days = ?, best_days = ?, last_active_day = ?
     WHERE member_id = ?`,
    [next.currentDays, next.bestDays, today, memberId],
  );
  if (next.currentDays === 3) {
    await awardActivity(connection, memberId, "streak", Number(today.replaceAll("-", "")));
  }
}

export interface PublicStreak {
  currentDays: number;
  bestDays: number;
  hasThreeDayBadge: boolean;
}

export async function getPublicStreak(
  connection: PoolConnection, handle: string,
): Promise<PublicStreak | null> {
  const [rows] = await connection.execute<PublicRow[]>(
    `SELECT COALESCE(s.current_days, 0) AS currentDays,
            COALESCE(s.best_days, 0) AS bestDays,
            DATE_FORMAT(s.last_active_day, '%Y-%m-%d') AS lastDay,
            DATE_FORMAT(UTC_DATE(), '%Y-%m-%d') AS today
     FROM member_profiles p LEFT JOIN member_streaks s ON s.member_id = p.member_id
     WHERE p.handle = ? LIMIT 1`, [handle],
  );
  if (!rows.length) return null;
  const row = rows[0];
  return {
    currentDays: visibleStreak(row, row.today),
    bestDays: row.bestDays,
    hasThreeDayBadge: row.bestDays >= 3,
  };
}
