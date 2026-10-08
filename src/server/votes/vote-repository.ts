import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import { awardActivity } from "@/server/reputation/reputation-repository";
import { recordUsefulActivity } from "@/server/streaks/streak-repository";
import { refreshSolution } from "@/server/solutions/solution-repository";
import { hiddenSql } from "@/server/reports/report-rules";

export const voteKinds = ["post", "comment", "project"] as const;
export type VoteKind = typeof voteKinds[number];

const config = {
  post: {
    table: "posts", votes: "post_votes",
    key: "post_id", action: "votePost",
  },
  comment: {
    table: "post_comments", votes: "comment_votes",
    key: "comment_id", action: "voteComment",
  },
  project: {
    table: "member_projects", votes: "project_votes",
    key: "project_id", action: "voteProject",
  },
} as const;

interface TargetRow extends RowDataPacket {
  id: number;
  postId: number | null;
  authorId: number;
  deletedAt: Date | null;
  parentDeletedAt: Date | null;
  hidden: number;
  parentHidden: number;
}
interface MemberRow extends RowDataPacket { id: number }
interface VoteRow extends RowDataPacket { count: number; voted: number }
interface ExistingVote extends RowDataPacket { active: number }

export interface VoteState { count: number; voted: boolean }
export type VoteFailure = "not_found" | "self";

async function targetOf(
  connection: PoolConnection, kind: VoteKind, id: string, lock: boolean,
): Promise<TargetRow | null> {
  const { table } = config[kind];
  const parent = kind === "comment"
    ? "JOIN posts p ON p.id = t.post_id" : "";
  const parentDeleted = kind === "comment"
    ? "p.deleted_at AS parentDeletedAt" : "NULL AS parentDeletedAt";
  const parentHidden = kind === "comment"
    ? hiddenSql("post", "p")
    : "0";
  const [rows] = await connection.execute<TargetRow[]>(
    `SELECT t.id, ${kind === "comment" ? "t.post_id AS postId" : "NULL AS postId"},
            t.member_id AS authorId,
            t.deleted_at AS deletedAt,
            ${parentDeleted},
            ${hiddenSql(kind, "t")} AS hidden,
            ${parentHidden} AS parentHidden
     FROM ${table} t ${parent} WHERE t.public_id = ? LIMIT 1
     ${lock ? "FOR UPDATE" : ""}`, [id],
  );
  const target = rows[0];
  return target &&
    !target.deletedAt &&
    !target.parentDeletedAt &&
    !target.hidden &&
    !target.parentHidden
    ? target
    : null;
}

async function stateOf(
  connection: PoolConnection, kind: VoteKind,
  targetId: number, viewerId: string | null,
): Promise<VoteState> {
  const { votes, key } = config[kind];
  const [rows] = await connection.execute<VoteRow[]>(
    `SELECT COUNT(*) AS count,
            COALESCE(MAX(CASE WHEN m.public_id = ? THEN 1 ELSE 0 END), 0) AS voted
     FROM ${votes} v JOIN members m ON m.id = v.voter_id
     WHERE v.${key} = ? AND v.active = 1`, [viewerId, targetId],
  );
  return { count: rows[0].count, voted: rows[0].voted === 1 };
}

export async function getVoteState(
  connection: PoolConnection, kind: VoteKind, id: string,
  viewerId: string | null,
): Promise<VoteState | null> {
  const target = await targetOf(connection, kind, id, false);
  return target ? stateOf(connection, kind, target.id, viewerId) : null;
}

export async function setVote(
  connection: PoolConnection, kind: VoteKind, id: string,
  viewerId: string, active: boolean,
): Promise<VoteState | VoteFailure> {
  await connection.beginTransaction();
  try {
    const target = await targetOf(connection, kind, id, true);
    if (!target) { await connection.rollback(); return "not_found"; }
    const [members] = await connection.execute<MemberRow[]>(
      "SELECT id FROM members WHERE public_id = ? LIMIT 1", [viewerId],
    );
    const voterId = members[0]?.id;
    if (!voterId) { await connection.rollback(); return "not_found"; }
    if (target.authorId === voterId) {
      await connection.rollback();
      return "self";
    }

    const { votes, key, action } = config[kind];
    if (active) {
      const [existing] = await connection.execute<ExistingVote[]>(
        `SELECT active FROM ${votes}
         WHERE ${key} = ? AND voter_id = ? FOR UPDATE`,
        [target.id, voterId],
      );
      if (!existing.length) {
        await connection.execute(
          `INSERT INTO ${votes}
           (${key}, voter_id, active, created_at, updated_at)
           VALUES (?, ?, 1, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3))`,
          [target.id, voterId],
        );
        await awardActivity(connection, voterId, action, target.id);
        await recordUsefulActivity(connection, voterId);
      } else if (existing[0].active === 0) {
        await connection.execute(
          `UPDATE ${votes}
           SET active = 1, updated_at = UTC_TIMESTAMP(3)
           WHERE ${key} = ? AND voter_id = ?`,
          [target.id, voterId],
        );
      }
    } else {
      await connection.execute(
        `UPDATE ${votes}
         SET active = 0, updated_at = UTC_TIMESTAMP(3)
         WHERE ${key} = ? AND voter_id = ? AND active = 1`,
        [target.id, voterId],
      );
    }
    if (kind === "comment" && target.postId !== null) {
      await refreshSolution(connection, target.postId);
    }
    const state = await stateOf(connection, kind, target.id, viewerId);
    await connection.commit();
    return state;
  } catch (error) {
    await connection.rollback();
    throw error;
  }
}
