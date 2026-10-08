import type { PoolConnection } from "mysql2/promise";
import { extractMentionedHandles } from "@/modules/notifications/domain/notification-input";

function mentions(handles: string[]): string {
  return handles.length
    ? `profile.handle IN (${handles.map(() => "?").join(",")})`
    : "0";
}

export async function notifyPublication(
  connection: PoolConnection,
  postId: number,
  authorId: number,
  text: string,
): Promise<void> {
  const handles = extractMentionedHandles(text);
  const condition = mentions(handles);

  await connection.execute(
    `INSERT INTO member_notifications
     (post_id, recipient_id, actor_id, kind, source_id, created_at)
     SELECT p.id, profile.member_id, p.member_id,
            CASE WHEN ${condition} THEN 'mention' ELSE 'publication' END,
            p.public_id, UTC_TIMESTAMP(3)
     FROM posts p
     JOIN (
       SELECT follower_id AS member_id
       FROM member_follows WHERE followed_id = ?
       UNION
       SELECT profile.member_id
       FROM member_profiles profile WHERE ${condition}
     ) recipients
     JOIN member_profiles profile ON profile.member_id = recipients.member_id
     JOIN member_private_identities identity_record
       ON identity_record.member_id = profile.member_id
     WHERE p.id = ? AND p.member_id = ? AND profile.member_id <> p.member_id
     ON DUPLICATE KEY UPDATE id = member_notifications.id`,
    [...handles, authorId, ...handles, postId, authorId],
  );
}

export async function notifyComment(
  connection: PoolConnection,
  commentId: number,
  text: string,
): Promise<void> {
  const handles = extractMentionedHandles(text);

  await connection.execute(
    `INSERT INTO member_notifications
     (post_id, comment_id, recipient_id, actor_id, kind, source_id, created_at)
     SELECT c.post_id, c.id, profile.member_id, c.member_id,
            CASE WHEN profile.member_id = COALESCE(parent.member_id, p.member_id)
              THEN 'reply' ELSE 'mention' END,
            c.public_id, UTC_TIMESTAMP(3)
     FROM post_comments c
     JOIN posts p ON p.id = c.post_id
     LEFT JOIN post_comments parent ON parent.id = c.parent_id
     JOIN member_profiles profile ON (
       profile.member_id = COALESCE(parent.member_id, p.member_id)
       OR ${mentions(handles)}
     )
     JOIN member_private_identities identity_record
       ON identity_record.member_id = profile.member_id
     WHERE c.id = ? AND profile.member_id <> c.member_id
     ON DUPLICATE KEY UPDATE id = member_notifications.id`,
    [...handles, commentId],
  );
}
