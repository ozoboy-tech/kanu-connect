import type { PoolConnection } from "mysql2/promise";

export {
  countUnreadNotifications,
  listNotifications,
  markNotificationRead,
} from "./notification-reader";

export async function notifyProjectOwner(
  connection: PoolConnection, projectId: number, actorId: number,
): Promise<void> {
  await connection.execute(
    `INSERT INTO member_notifications
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
    `INSERT INTO member_notifications
     (project_id, recipient_id, actor_id, kind, created_at)
     VALUES (?, ?, ?, ?, UTC_TIMESTAMP(3))`,
    [projectId, applicantId, actorId, decision],
  );
}

export async function notifyDiscussionParticipants(
  connection: PoolConnection, projectId: number, actorId: number,
): Promise<void> {
  await connection.execute(
    `INSERT INTO member_notifications
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