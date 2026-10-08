import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import {
  parseDiscussionCursor, parseDiscussionMessage,
  type DiscussionMessage, type DiscussionPage,
} from "@/modules/projects/domain/discussion-input";
import { hiddenSql } from "@/server/reports/report-rules";
import { notifyDiscussionParticipants } from
  "@/server/notifications/notification-repository";


type Access = RowDataPacket & { projectId: number; memberId: number };
type MessageRow = RowDataPacket & Omit<DiscussionMessage, "createdAt"> & {
  createdAt: Date;
};

async function access(
  connection: PoolConnection, projectId: string, viewerId: string,
): Promise<Access | null> {
  const [rows] = await connection.execute<Access[]>(
    `SELECT p.id AS projectId, m.id AS memberId
     FROM member_projects p
     JOIN members m ON m.public_id = ?
     JOIN member_profiles profile ON profile.member_id = m.id
     JOIN member_private_identities identity_record ON identity_record.member_id = m.id
     WHERE p.public_id = ? AND p.deleted_at IS NULL
       AND NOT ${hiddenSql("project", "p")}
       AND (p.member_id = m.id OR EXISTS (
         SELECT 1 FROM project_collaboration_requests request_record
         WHERE request_record.project_id = p.id
           AND request_record.member_id = m.id
           AND request_record.status = 'accepted'
       ))`, [viewerId, projectId],
  );
  return rows[0] ?? null;
}

export async function listDiscussionMessages(
  connection: PoolConnection, projectId: string, viewerId: string,
  before: string | null = null,
): Promise<DiscussionPage | null> {
  const cursor = parseDiscussionCursor(before);
  const target = await access(connection, projectId, viewerId);
  if (!target) return null;
  const values: (string | number)[] = [target.projectId];
  if (cursor) values.push(cursor);
  const [rows] = await connection.execute<MessageRow[]>(
    `SELECT CAST(d.id AS CHAR) AS id, m.public_id AS authorId,
            profile.handle AS authorHandle, d.body, d.created_at AS createdAt
     FROM project_discussion_messages d
     JOIN members m ON m.id = d.author_id
     JOIN member_profiles profile ON profile.member_id = m.id
     WHERE d.project_id = ?${cursor ? " AND d.id < CAST(? AS UNSIGNED)" : ""}
     ORDER BY d.id DESC LIMIT 21`, values,
  );
  const page = rows.slice(0, 20);
  return {
    messages: page.map((row) => ({
      id: row.id, authorId: row.authorId, authorHandle: row.authorHandle,
      body: row.body, createdAt: row.createdAt.toISOString(),
    })),
    nextCursor: rows.length > 20 ? page[page.length - 1].id : null,
  };
}

export async function sendDiscussionMessage(
  connection: PoolConnection, projectId: string, viewerId: string, input: unknown,
): Promise<"ok" | "not_found"> {
  const body = parseDiscussionMessage(input);
  await connection.beginTransaction();
  try {
    await connection.execute(
      "SELECT id FROM member_projects WHERE public_id = ? FOR UPDATE", [projectId],
    );
    const target = await access(connection, projectId, viewerId);
    if (!target) {
      await connection.rollback();
      return "not_found";
    }
    await connection.execute(
      `INSERT INTO project_discussion_messages (project_id, author_id, body, created_at)
       VALUES (?, ?, ?, UTC_TIMESTAMP(3))`,
      [target.projectId, target.memberId, body],
    );
    await notifyDiscussionParticipants(connection, target.projectId, target.memberId);
    await connection.commit();
    return "ok";
  } catch (error) {
    await connection.rollback();
    throw error;
  }
}
