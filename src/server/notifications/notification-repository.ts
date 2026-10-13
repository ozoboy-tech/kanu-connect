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
     FROM member_projects p
     LEFT JOIN member_notification_preferences pref ON pref.member_id = p.member_id
     WHERE p.id = ? AND p.member_id <> ?
       AND COALESCE(pref.projects_enabled, 1) = 1`,
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
     SELECT ?, applicant.id, ?, ?, UTC_TIMESTAMP(3)
     FROM members applicant
     LEFT JOIN member_notification_preferences pref ON pref.member_id = applicant.id
     WHERE applicant.id = ? AND COALESCE(pref.projects_enabled, 1) = 1`,
    [projectId, actorId, decision, applicantId],
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
     ) recipients
     LEFT JOIN member_notification_preferences pref ON pref.member_id = recipients.member_id
     WHERE recipients.member_id <> ? AND COALESCE(pref.projects_enabled, 1) = 1`,
    [projectId, actorId, projectId, projectId, actorId],
  );
}
