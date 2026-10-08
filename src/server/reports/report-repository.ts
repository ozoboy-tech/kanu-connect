import type { PoolConnection, RowDataPacket } from "mysql2/promise";

import { refreshSolution } from
  "@/server/solutions/solution-repository";
import {
  hiddenSql,
  type ReportKind,
  type ReportReason,
} from "./report-rules";

const config = {
  post: { table: "posts", key: "post_id" },
  comment: { table: "post_comments", key: "comment_id" },
  project: { table: "member_projects", key: "project_id" },
} as const;

interface Target extends RowDataPacket {
  id: number;
  postId: number | null;
  authorId: string;
  deletedAt: Date | null;
  parentDeletedAt: Date | null;
  parentHidden: number;
  hidden: number;
}

interface Reporter extends RowDataPacket {
  id: number;
}

interface Count extends RowDataPacket {
  count: number;
  reported: number;
}

export interface ReportState {
  reported: boolean;
  hidden: boolean;
}

export type ReportResult = ReportState | "not_found" | "self";

async function targetOf(
  connection: PoolConnection,
  kind: ReportKind,
  id: string,
  lock: boolean,
): Promise<Target | null> {
  const { table } = config[kind];
  const parent = kind === "comment"
    ? "JOIN posts p ON p.id = t.post_id"
    : "";
  const parentFields = kind === "comment"
    ? `t.post_id AS postId, p.deleted_at AS parentDeletedAt,
       ${hiddenSql("post", "p")} AS parentHidden`
    : "NULL AS postId, NULL AS parentDeletedAt, 0 AS parentHidden";

  const [rows] = await connection.execute<Target[]>(
    `SELECT t.id, m.public_id AS authorId,
            t.deleted_at AS deletedAt,
            ${hiddenSql(kind, "t")} AS hidden,
            ${parentFields}
     FROM ${table} t ${parent}
     JOIN members m ON m.id = t.member_id
     WHERE t.public_id = ?
     LIMIT 1 ${lock ? "FOR UPDATE" : ""}`,
    [id],
  );

  const target = rows[0];
  return target &&
    !target.deletedAt &&
    !target.parentDeletedAt &&
    !target.parentHidden &&
    !target.hidden
    ? target
    : null;
}

async function stateOf(
  connection: PoolConnection,
  kind: ReportKind,
  targetId: number,
  viewerId: string,
): Promise<ReportState> {
  const [rows] = await connection.execute<Count[]>(
    `SELECT COUNT(*) AS count,
            COALESCE(
              MAX(CASE WHEN m.public_id = ? THEN 1 ELSE 0 END),
              0
            ) AS reported
     FROM content_reports r
     JOIN members m ON m.id = r.reporter_id
     WHERE r.${config[kind].key} = ?`,
    [viewerId, targetId],
  );

  return {
    reported: rows[0].reported === 1,
    hidden: rows[0].count >= 3,
  };
}

export async function getReportState(
  connection: PoolConnection,
  kind: ReportKind,
  id: string,
  viewerId: string,
): Promise<ReportState | null> {
  const target = await targetOf(connection, kind, id, false);
  return target
    ? stateOf(connection, kind, target.id, viewerId)
    : null;
}

export async function reportContent(
  connection: PoolConnection,
  kind: ReportKind,
  id: string,
  viewerId: string,
  reason: ReportReason,
): Promise<ReportResult> {
  await connection.beginTransaction();

  try {
    const target = await targetOf(connection, kind, id, true);

    if (!target) {
      await connection.rollback();
      return "not_found";
    }

    if (target.authorId === viewerId) {
      await connection.rollback();
      return "self";
    }

    const [members] = await connection.execute<Reporter[]>(
      "SELECT id FROM members WHERE public_id = ? LIMIT 1",
      [viewerId],
    );

    if (!members.length) {
      await connection.rollback();
      return "not_found";
    }

    const before = await stateOf(
      connection,
      kind,
      target.id,
      viewerId,
    );

    if (!before.reported) {
      await connection.execute(
        `INSERT INTO content_reports
         (reporter_id, ${config[kind].key}, reason, created_at)
         VALUES (?, ?, ?, UTC_TIMESTAMP(3))`,
        [members[0].id, target.id, reason],
      );
    }

    const after = await stateOf(
      connection,
      kind,
      target.id,
      viewerId,
    );

    if (!before.hidden && after.hidden && target.postId !== null) {
      await refreshSolution(connection, target.postId);
    }

    if (!before.hidden && after.hidden && kind === "post") {
      await refreshSolution(connection, target.id);
    }

    await connection.commit();
    return after;
  } catch (error) {
    await connection.rollback();
    throw error;
  }
}
