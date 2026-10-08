import type {
  PoolConnection,
  RowDataPacket,
} from "mysql2/promise";

import type { ReportKind } from
  "@/server/reports/report-rules";
import { refreshSolution } from
  "@/server/solutions/solution-repository";
import { isModerator } from "./moderator";

export type ModerationDecision = "hide" | "restore";

interface QueueRow extends RowDataPacket {
  kind: ReportKind;
  id: string;
  pageId: string;
  authorHandle: string;
  preview: string;
  count: number;
  decision: ModerationDecision | null;
  note: string | null;
  lastAt: Date;
}

export interface ModerationItem {
  kind: ReportKind;
  id: string;
  url: string;
  authorHandle: string;
  preview: string;
  count: number;
  decision: ModerationDecision | null;
  note: string | null;
  hidden: boolean;
}

interface TargetRow extends RowDataPacket {
  id: number;
  postId: number | null;
  deletedAt: Date | null;
}

interface IdRow extends RowDataPacket {
  id: number;
}

const targets = {
  post: {
    table: "posts",
    key: "post_id",
  },
  comment: {
    table: "post_comments",
    key: "comment_id",
  },
  project: {
    table: "member_projects",
    key: "project_id",
  },
} as const;

export async function listModerationQueue(
  connection: PoolConnection,
  moderatorId: string,
): Promise<ModerationItem[]> {
  if (!isModerator(moderatorId)) {
    throw new Error("Accès refusé.");
  }

  const [rows] = await connection.execute<QueueRow[]>(
    `SELECT 'post' AS kind,
            p.public_id AS id,
            p.public_id AS pageId,
            profile.handle AS authorHandle,
            LEFT(CONCAT(p.title, ' — ', p.body), 280) AS preview,
            r.total AS count,
            d.decision,
            d.note,
            r.lastAt
     FROM (
       SELECT post_id AS target,
              COUNT(*) AS total,
              MAX(created_at) AS lastAt
       FROM content_reports
       WHERE post_id IS NOT NULL
       GROUP BY post_id
     ) r
     JOIN posts p
       ON p.id = r.target AND p.deleted_at IS NULL
     JOIN member_profiles profile
       ON profile.member_id = p.member_id
     LEFT JOIN content_moderation_decisions d
       ON d.post_id = p.id

     UNION ALL

     SELECT 'comment',
            c.public_id,
            p.public_id,
            profile.handle,
            LEFT(c.body, 280),
            r.total,
            d.decision,
            d.note,
            r.lastAt
     FROM (
       SELECT comment_id AS target,
              COUNT(*) AS total,
              MAX(created_at) AS lastAt
       FROM content_reports
       WHERE comment_id IS NOT NULL
       GROUP BY comment_id
     ) r
     JOIN post_comments c
       ON c.id = r.target AND c.deleted_at IS NULL
     JOIN posts p
       ON p.id = c.post_id AND p.deleted_at IS NULL
     JOIN member_profiles profile
       ON profile.member_id = c.member_id
     LEFT JOIN content_moderation_decisions d
       ON d.comment_id = c.id

     UNION ALL

     SELECT 'project',
            p.public_id,
            p.public_id,
            profile.handle,
            LEFT(CONCAT(p.title, ' — ', p.description), 280),
            r.total,
            d.decision,
            d.note,
            r.lastAt
     FROM (
       SELECT project_id AS target,
              COUNT(*) AS total,
              MAX(created_at) AS lastAt
       FROM content_reports
       WHERE project_id IS NOT NULL
       GROUP BY project_id
     ) r
     JOIN member_projects p
       ON p.id = r.target AND p.deleted_at IS NULL
     JOIN member_profiles profile
       ON profile.member_id = p.member_id
     LEFT JOIN content_moderation_decisions d
       ON d.project_id = p.id

     ORDER BY lastAt DESC
     LIMIT 50`,
  );

  return rows.map((row) => ({
    kind: row.kind,
    id: row.id,
    url: row.kind === "project"
      ? `/projects/${row.id}`
      : `/posts/${row.pageId}`,
    authorHandle: row.authorHandle,
    preview: row.preview,
    count: row.count,
    decision: row.decision,
    note: row.note,
    hidden: row.decision === "hide" ||
      (
        row.decision === null &&
        row.count >= 3
      ),
  }));
}

export type ReviewResult =
  | "ok"
  | "not_found"
  | "forbidden";

export async function reviewContent(
  connection: PoolConnection,
  kind: ReportKind,
  id: string,
  moderatorId: string,
  decision: ModerationDecision,
  note: string,
): Promise<ReviewResult> {
  if (!isModerator(moderatorId)) {
    return "forbidden";
  }

  await connection.beginTransaction();

  try {
    const { table, key } = targets[kind];

    const [members] = await connection.execute<IdRow[]>(
      "SELECT id FROM members WHERE public_id = ? LIMIT 1",
      [moderatorId],
    );

    if (!members.length) {
      await connection.rollback();
      return "forbidden";
    }

    const [rows] = await connection.execute<TargetRow[]>(
      `SELECT id,
              deleted_at AS deletedAt,
              ${kind === "comment" ? "post_id" : "NULL"} AS postId
       FROM ${table}
       WHERE public_id = ?
       FOR UPDATE`,
      [id],
    );

    const target = rows[0];

    if (!target || target.deletedAt) {
      await connection.rollback();
      return "not_found";
    }

    const [reports] = await connection.execute<IdRow[]>(
      `SELECT id
       FROM content_reports
       WHERE ${key} = ?
       LIMIT 1`,
      [target.id],
    );

    if (!reports.length) {
      await connection.rollback();
      return "not_found";
    }

    await connection.execute(
      `INSERT INTO content_moderation_decisions
       (${key}, moderator_id, decision, note, reviewed_at)
       VALUES (?, ?, ?, ?, UTC_TIMESTAMP(3))
       ON DUPLICATE KEY UPDATE
         moderator_id = VALUES(moderator_id),
         decision = VALUES(decision),
         note = VALUES(note),
         reviewed_at = UTC_TIMESTAMP(3)`,
      [
        target.id,
        members[0].id,
        decision,
        note,
      ],
    );

    if (kind === "post") {
      await refreshSolution(connection, target.id);
    }

    if (kind === "comment" && target.postId !== null) {
      await refreshSolution(connection, target.postId);
    }

    await connection.commit();
    return "ok";
  } catch (error) {
    await connection.rollback();
    throw error;
  }
}
