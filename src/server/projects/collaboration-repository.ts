import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import {
  parseCollaborationCursor, parseCollaborationDecision, parseCollaborationMessage,
  type CollaborationRequest, type CollaborationState,
} from "@/modules/projects/domain/collaboration-input";
import { hiddenSql } from "@/server/reports/report-rules";

type Result = "ok" | "not_found" | "forbidden" | "duplicate" | "conflict";
type Access = { projectId: number; memberId: number; isOwner: boolean };
type RequestRow = RowDataPacket & CollaborationRequest & { cursor: string };

async function access(
  connection: PoolConnection, projectId: string, viewerId: string, lock = false,
): Promise<Access | null> {
  const [projects] = await connection.execute<(
    RowDataPacket & { id: number; ownerId: number; deletedAt: Date | null }
  )[]>(
    `SELECT id, member_id AS ownerId, deleted_at AS deletedAt
     FROM member_projects WHERE public_id = ?${lock ? " FOR UPDATE" : ""}`,
    [projectId],
  );
  const project = projects[0];
  if (!project || project.deletedAt) return null;
  const [visibility] = await connection.execute<(RowDataPacket & { hidden: number })[]>(
    `SELECT ${hiddenSql("project", "p")} AS hidden
     FROM member_projects p WHERE p.id = ?`, [project.id],
  );
  if (visibility[0].hidden) return null;
  const [members] = await connection.execute<(RowDataPacket & { id: number })[]>(
    `SELECT m.id FROM members m
     JOIN member_profiles p ON p.member_id = m.id
     JOIN member_private_identities i ON i.member_id = m.id
     WHERE m.public_id = ?`, [viewerId],
  );
  if (!members[0]) return null;
  return {
    projectId: project.id, memberId: members[0].id,
    isOwner: project.ownerId === members[0].id,
  };
}

async function mutate(
  connection: PoolConnection, projectId: string, viewerId: string,
  operation: (target: Access) => Promise<Result>,
): Promise<Result> {
  await connection.beginTransaction();
  try {
    const target = await access(connection, projectId, viewerId, true);
    const result = target ? await operation(target) : "not_found";
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  }
}

export async function requestCollaboration(
  connection: PoolConnection, projectId: string, memberId: string, input: unknown,
): Promise<Result> {
  const message = parseCollaborationMessage(input);
  return mutate(connection, projectId, memberId, async (target) => {
    if (target.isOwner) return "forbidden";
    const [existing] = await connection.execute<RowDataPacket[]>(
      `SELECT id FROM project_collaboration_requests
       WHERE project_id = ? AND member_id = ?`, [target.projectId, target.memberId],
    );
    if (existing.length) return "duplicate";
    await connection.execute(
      `INSERT INTO project_collaboration_requests
       (project_id, member_id, message, status, created_at)
       VALUES (?, ?, ?, 'pending', UTC_TIMESTAMP(3))`,
      [target.projectId, target.memberId, message],
    );
    return "ok";
  });
}

export async function listCollaborations(
  connection: PoolConnection, projectId: string, viewerId: string,
  before: string | null = null,
): Promise<CollaborationState | null> {
  const cursor = parseCollaborationCursor(before);
  const target = await access(connection, projectId, viewerId);
  if (!target) return null;
  const values: (string | number)[] = [target.projectId];
  let filter = "";
  if (!target.isOwner) {
    filter += " AND r.member_id = ?";
    values.push(target.memberId);
  } else if (cursor) {
    filter += " AND r.id < ?";
    values.push(cursor);
  }
  const [rows] = await connection.execute<RequestRow[]>(
    `SELECT CAST(r.id AS CHAR) AS \`cursor\`, m.public_id AS memberId,
            p.handle, r.message, r.status
     FROM project_collaboration_requests r
     JOIN members m ON m.id = r.member_id
     JOIN member_profiles p ON p.member_id = m.id
     WHERE r.project_id = ?${filter} ORDER BY r.id DESC LIMIT 21`, values,
  );
  const page = rows.slice(0, 20);
  return {
    isOwner: target.isOwner,
    requests: page.map(({ memberId, handle, message, status }) => ({
      memberId, handle, message, status,
    })),
    nextCursor: rows.length > 20 ? page[page.length - 1].cursor : null,
  };
}

export async function decideCollaboration(
  connection: PoolConnection, projectId: string, ownerId: string,
  applicantId: string, input: unknown,
): Promise<Result> {
  const decision = parseCollaborationDecision(input);
  return mutate(connection, projectId, ownerId, async (target) => {
    if (!target.isOwner) return "forbidden";
    const [requests] = await connection.execute<(
      RowDataPacket & { id: number; status: string }
    )[]>(
      `SELECT r.id, r.status FROM project_collaboration_requests r
       JOIN members m ON m.id = r.member_id
       WHERE r.project_id = ? AND m.public_id = ?`,
      [target.projectId, applicantId],
    );
    if (!requests[0]) return "not_found";
    if (requests[0].status !== "pending") return "conflict";
    await connection.execute(
      `UPDATE project_collaboration_requests
       SET status = ?, decided_at = UTC_TIMESTAMP(3) WHERE id = ?`,
      [decision, requests[0].id],
    );
    return "ok";
  });
}
