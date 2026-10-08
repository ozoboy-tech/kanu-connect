import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import {
  parseNotificationId, type NotificationKind, type NotificationPage,
  type ProjectNotification,
} from "@/modules/notifications/domain/notification-input";
import { hiddenSql } from "@/server/reports/report-rules";

interface NotificationRow extends RowDataPacket {
  id: string;
  kind: NotificationKind;
  projectId: string;
  projectTitle: string;
  actorHandle: string;
  createdAt: Date;
  readAt: Date | null;
}

const visibleProject = `p.deleted_at IS NULL AND NOT ${hiddenSql("project", "p")}`;

export async function notifyProjectOwner(
  connection: PoolConnection, projectId: number, actorId: number,
): Promise<void> {
  await connection.execute(
    `INSERT INTO project_notifications
     (project_id, recipient_id, actor_id, kind, created_at)
     SELECT p.id, p.member_id, ?, 'request', UTC_TIMESTAMP(3)
     FROM member_projects p WHERE p.id = ? AND p.member_id <> ?`,
    [actorId, projectId, actorId],
  );
}

export async function notifyApplicant(
  connection: PoolConnection, projectId: number, actorId: number,
  applicantId: number, decision: "accepted" | "rejected",
): Promise<void> {
  await connection.execute(
    `INSERT INTO project_notifications
     (project_id, recipient_id, actor_id, kind, created_at)
     VALUES (?, ?, ?, ?, UTC_TIMESTAMP(3))`,
    [projectId, applicantId, actorId, decision],
  );
}

export async function notifyDiscussionParticipants(
  connection: PoolConnection, projectId: number, actorId: number,
): Promise<void> {
  await connection.execute(
    `INSERT INTO project_notifications
     (project_id, recipient_id, actor_id, kind, created_at)
     SELECT ?, recipients.member_id, ?, 'discussion', UTC_TIMESTAMP(3)
     FROM (
       SELECT member_id FROM member_projects WHERE id = ?
       UNION
       SELECT member_id FROM project_collaboration_requests
       WHERE project_id = ? AND status = 'accepted'
     ) recipients WHERE recipients.member_id <> ?`,
    [projectId, actorId, projectId, projectId, actorId],
  );
}

export async function countUnreadNotifications(
  connection: PoolConnection, memberId: string,
): Promise<number> {
  const [rows] = await connection.execute<(RowDataPacket & { total: number })[]>(
    `SELECT COUNT(*) AS total FROM project_notifications n
     JOIN members recipient ON recipient.id = n.recipient_id
     JOIN member_projects p ON p.id = n.project_id
     WHERE recipient.public_id = ? AND n.read_at IS NULL AND ${visibleProject}`,
    [memberId],
  );
  return rows[0].total;
}

export async function listNotifications(
  connection: PoolConnection, memberId: string,
  before: string | null = null,
): Promise<NotificationPage> {
  const cursor = parseNotificationId(before);
  const values = cursor ? [memberId, cursor] : [memberId];
  const [rows] = await connection.execute<NotificationRow[]>(
    `SELECT CAST(n.id AS CHAR) AS id, n.kind,
            p.public_id AS projectId, p.title AS projectTitle,
            profile.handle AS actorHandle,
            n.created_at AS createdAt, n.read_at AS readAt
     FROM project_notifications n
     JOIN members recipient ON recipient.id = n.recipient_id
     JOIN member_projects p ON p.id = n.project_id
     JOIN member_profiles profile ON profile.member_id = n.actor_id
     WHERE recipient.public_id = ? AND ${visibleProject}
       ${cursor ? "AND n.id < CAST(? AS UNSIGNED)" : ""}
     ORDER BY n.id DESC LIMIT 21`, values,
  );
  const page = rows.slice(0, 20);
  const notifications: ProjectNotification[] = page.map((row) => ({
    id: row.id, kind: row.kind, projectId: row.projectId,
    projectTitle: row.projectTitle, actorHandle: row.actorHandle,
    createdAt: row.createdAt.toISOString(), readAt: row.readAt?.toISOString() ?? null,
  }));
  return {
    notifications, unreadCount: await countUnreadNotifications(connection, memberId),
    nextCursor: rows.length > 20 ? page[19].id : null,
  };
}

export async function markNotificationRead(
  connection: PoolConnection, memberId: string, id: string,
): Promise<"ok" | "not_found"> {
  const parsed = parseNotificationId(id);
  if (!parsed) throw new TypeError("Identifiant requis.");
  const [rows] = await connection.execute<(RowDataPacket & { id: number })[]>(
    `SELECT n.id FROM project_notifications n
     JOIN members recipient ON recipient.id = n.recipient_id
     JOIN member_projects p ON p.id = n.project_id
     WHERE n.id = CAST(? AS UNSIGNED) AND recipient.public_id = ?
       AND ${visibleProject}`, [parsed, memberId],
  );
  if (!rows.length) return "not_found";
  await connection.execute(
    `UPDATE project_notifications n
     JOIN members recipient ON recipient.id = n.recipient_id
     SET n.read_at = COALESCE(n.read_at, UTC_TIMESTAMP(3))
     WHERE n.id = CAST(? AS UNSIGNED) AND recipient.public_id = ?`,
    [parsed, memberId],
  );
  return "ok";
}
