import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import {
  parseNotificationId,
  type Notification,
  type NotificationKind,
  type NotificationPage,
  type ProjectNotificationKind,
  type CommunityNotificationKind,
} from "@/modules/notifications/domain/notification-input";
import { hiddenSql } from "@/server/reports/report-rules";

interface NotificationRow extends RowDataPacket {
  id: string;
  kind: NotificationKind;
  projectId: string | null;
  projectTitle: string | null;
  postId: string | null;
  postTitle: string | null;
  actorHandle: string;
  createdAt: Date;
  readAt: Date | null;
}

const tables = `FROM member_notifications n
  JOIN members recipient ON recipient.id = n.recipient_id
  LEFT JOIN member_projects project ON project.id = n.project_id
  LEFT JOIN posts p ON p.id = n.post_id
  LEFT JOIN post_comments c ON c.id = n.comment_id`;

const visible = `(
  (n.project_id IS NOT NULL AND project.deleted_at IS NULL
    AND NOT ${hiddenSql("project", "project")})
  OR
  (n.post_id IS NOT NULL AND p.deleted_at IS NULL
    AND NOT ${hiddenSql("post", "p")}
    AND (n.comment_id IS NULL OR
      (c.deleted_at IS NULL AND NOT ${hiddenSql("comment", "c")})))
)`;

export async function countUnreadNotifications(
  connection: PoolConnection,
  memberId: string,
): Promise<number> {
  const [rows] = await connection.execute<(RowDataPacket & { total: number })[]>(
    `SELECT COUNT(*) AS total ${tables}
     WHERE recipient.public_id = ? AND n.read_at IS NULL AND ${visible}`,
    [memberId],
  );

  return rows[0].total;
}

export async function listNotifications(
  connection: PoolConnection,
  memberId: string,
  before: string | null = null,
): Promise<NotificationPage> {
  const cursor = parseNotificationId(before);

  const [rows] = await connection.execute<NotificationRow[]>(
    `SELECT CAST(n.id AS CHAR) AS id, n.kind,
            project.public_id AS projectId, project.title AS projectTitle,
            p.public_id AS postId, p.title AS postTitle,
            profile.handle AS actorHandle,
            n.created_at AS createdAt, n.read_at AS readAt
     ${tables}
     JOIN member_profiles profile ON profile.member_id = n.actor_id
     WHERE recipient.public_id = ? AND ${visible}
       ${cursor ? "AND n.id < CAST(? AS UNSIGNED)" : ""}
     ORDER BY n.id DESC LIMIT 21`,
    cursor ? [memberId, cursor] : [memberId],
  );

  const page = rows.slice(0, 20);

  const notifications: Notification[] = page.map((row) => {
    const common = {
      id: row.id,
      actorHandle: row.actorHandle,
      createdAt: row.createdAt.toISOString(),
      readAt: row.readAt?.toISOString() ?? null,
    };

    return row.projectId
      ? {
          ...common,
          kind: row.kind as ProjectNotificationKind,
          projectId: row.projectId,
          projectTitle: row.projectTitle!,
        }
      : {
          ...common,
          kind: row.kind as CommunityNotificationKind,
          postId: row.postId!,
          postTitle: row.postTitle!,
        };
  });

  return {
    notifications,
    unreadCount: await countUnreadNotifications(connection, memberId),
    nextCursor: rows.length > 20 ? page[19].id : null,
  };
}

export async function markNotificationRead(
  connection: PoolConnection,
  memberId: string,
  id: string,
): Promise<"ok" | "not_found"> {
  const parsed = parseNotificationId(id);
  if (!parsed) throw new TypeError("Identifiant requis.");

  const [rows] = await connection.execute<RowDataPacket[]>(
    `SELECT n.id ${tables}
     WHERE n.id = CAST(? AS UNSIGNED)
       AND recipient.public_id = ? AND ${visible}`,
    [parsed, memberId],
  );

  if (!rows.length) return "not_found";

  await connection.execute(
    `UPDATE member_notifications n
     JOIN members recipient ON recipient.id = n.recipient_id
     SET n.read_at = COALESCE(n.read_at, UTC_TIMESTAMP(3))
     WHERE n.id = CAST(? AS UNSIGNED) AND recipient.public_id = ?`,
    [parsed, memberId],
  );

  return "ok";
}
