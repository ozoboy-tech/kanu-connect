import type { PoolConnection, RowDataPacket } from "mysql2/promise";

import { calculateAwardedPoints } from
  "@/modules/reputation/domain/calculate-awarded-points";
import { ACTION_POINTS } from
  "@/modules/reputation/domain/reputation-rules";

interface QuestionRow extends RowDataPacket {
  id: number;
  authorId?: string;
  kind: string;
  deletedAt: Date | null;
}
interface WinnerRow extends RowDataPacket {
  commentId: number;
  memberId: number;
  votes: number;
}
interface RewardRow extends RowDataPacket {
  memberId: number;
  points: number;
  dayUtc: string;
}
interface DayRow extends RowDataPacket { points: number }
interface ClockRow extends RowDataPacket { today: string }
interface StateRow extends RowDataPacket {
  commentId: string | null;
  resolved: number | null;
  votes: number;
}

export interface SolutionState {
  commentId: string | null;
  resolved: boolean;
  votes: number;
}

export async function getSolutionState(
  connection: PoolConnection, postId: string,
): Promise<SolutionState | null> {
  const [rows] = await connection.execute<StateRow[]>(
    `SELECT c.public_id AS commentId, s.resolved,
            (SELECT COUNT(*) FROM comment_votes v
             WHERE v.comment_id = s.comment_id
               AND v.active = 1) AS votes
     FROM posts p
     LEFT JOIN post_solutions s ON s.post_id = p.id
     LEFT JOIN post_comments c
       ON c.id = s.comment_id AND c.deleted_at IS NULL
     WHERE p.public_id = ?
       AND p.kind = 'question'
       AND p.deleted_at IS NULL
     LIMIT 1`,
    [postId],
  );
  if (!rows.length) return null;
  return {
    commentId: rows[0].commentId,
    resolved: rows[0].resolved === 1,
    votes: rows[0].votes,
  };
}

// À appeler depuis une transaction qui verrouille la question.
export async function refreshSolution(
  connection: PoolConnection, postInternalId: number,
): Promise<void> {
  const [questions] = await connection.execute<QuestionRow[]>(
    `SELECT id, kind, deleted_at AS deletedAt
     FROM posts WHERE id = ? FOR UPDATE`,
    [postInternalId],
  );
  const question = questions[0];
  if (!question) return;

  if (question.kind !== "question") {
    const [existing] = await connection.execute<RowDataPacket[]>(
      `SELECT post_id FROM post_solutions
       WHERE post_id = ? LIMIT 1`,
      [postInternalId],
    );
    if (!existing.length) return;
  }

  let winner: WinnerRow | null = null;
  if (!question.deletedAt && question.kind === "question") {
    const [candidates] = await connection.execute<WinnerRow[]>(
      `SELECT c.id AS commentId,
              c.member_id AS memberId,
              COUNT(*) AS votes
       FROM post_comments c
       JOIN comment_votes v
         ON v.comment_id = c.id AND v.active = 1
       WHERE c.post_id = ?
         AND c.deleted_at IS NULL
       GROUP BY c.id, c.member_id, c.created_at
       HAVING COUNT(*) >= 3
       ORDER BY votes DESC, c.created_at ASC, c.id ASC
       LIMIT 1`,
      [postInternalId],
    );
    winner = candidates[0] ?? null;
  }

  await connection.execute(
    `INSERT INTO post_solutions
     (post_id, comment_id, resolved, updated_at)
     VALUES (?, ?, 0, UTC_TIMESTAMP(3))
     ON DUPLICATE KEY UPDATE
       comment_id = VALUES(comment_id),
       resolved = IF(?, resolved, 0),
       updated_at = UTC_TIMESTAMP(3)`,
    [
      postInternalId,
      winner?.commentId ?? null,
      question.kind === "question" && !question.deletedAt ? 1 : 0,
    ],
  );

  const [rewards] = await connection.execute<RewardRow[]>(
    `SELECT member_id AS memberId,
            points,
            DATE_FORMAT(day_utc, '%Y-%m-%d') AS dayUtc
     FROM post_solution_rewards
     WHERE post_id = ? FOR UPDATE`,
    [postInternalId],
  );
  const old = rewards[0];
  if (old && winner?.memberId === old.memberId) return;

  const [todayRows] = await connection.execute<ClockRow[]>(
    "SELECT DATE_FORMAT(UTC_DATE(), '%Y-%m-%d') AS today",
  );
  const today = todayRows[0].today;

  if (old) {
    await connection.execute(
      "DELETE FROM post_solution_rewards WHERE post_id = ?",
      [postInternalId],
    );
    if (old.dayUtc === today && old.points > 0) {
      await connection.execute(
        `UPDATE member_reputation_days
         SET points = points - ?
         WHERE member_id = ? AND day_utc = ?`,
        [old.points, old.memberId, today],
      );
    }
  }

  if (!winner) return;

  await connection.execute(
    `INSERT INTO member_reputation_days
     (member_id, day_utc, points)
     VALUES (?, ?, 0)
     ON DUPLICATE KEY UPDATE member_id = member_id`,
    [winner.memberId, today],
  );

  const [days] = await connection.execute<DayRow[]>(
    `SELECT points FROM member_reputation_days
     WHERE member_id = ? AND day_utc = ? FOR UPDATE`,
    [winner.memberId, today],
  );
  const awarded = calculateAwardedPoints(
    ACTION_POINTS.solution,
    days[0].points,
  );

  await connection.execute(
    `INSERT INTO post_solution_rewards
     (post_id, member_id, points, day_utc, awarded_at)
     VALUES (?, ?, ?, ?, UTC_TIMESTAMP(3))`,
    [postInternalId, winner.memberId, awarded, today],
  );
  if (awarded) {
    await connection.execute(
      `UPDATE member_reputation_days
       SET points = points + ?
       WHERE member_id = ? AND day_utc = ?`,
      [awarded, winner.memberId, today],
    );
  }
}

export type ResolveResult = "ok" | "not_found" | "forbidden";

export async function setQuestionResolved(
  connection: PoolConnection,
  postId: string,
  authorId: string,
  resolved: boolean,
): Promise<ResolveResult> {
  await connection.beginTransaction();
  try {
    const [rows] = await connection.execute<QuestionRow[]>(
      `SELECT p.id, p.kind,
              p.deleted_at AS deletedAt,
              m.public_id AS authorId
       FROM posts p
       JOIN members m ON m.id = p.member_id
       WHERE p.public_id = ? FOR UPDATE`,
      [postId],
    );
    const question = rows[0];
    if (
      !question ||
      question.kind !== "question" ||
      question.deletedAt
    ) {
      await connection.rollback();
      return "not_found";
    }
    if (question.authorId !== authorId) {
      await connection.rollback();
      return "forbidden";
    }

    await connection.execute(
      `INSERT INTO post_solutions
       (post_id, comment_id, resolved, updated_at)
       VALUES (?, NULL, ?, UTC_TIMESTAMP(3))
       ON DUPLICATE KEY UPDATE
         resolved = VALUES(resolved),
         updated_at = UTC_TIMESTAMP(3)`,
      [question.id, resolved ? 1 : 0],
    );
    await connection.commit();
    return "ok";
  } catch (error) {
    await connection.rollback();
    throw error;
  }
}
