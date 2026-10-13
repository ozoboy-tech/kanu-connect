import { randomUUID } from "node:crypto";
import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { parseProjectInput, type ProjectInput, type ProjectRole, type ProjectStatus } from "@/modules/projects/domain/project-input";
import { awardActivity } from "@/server/reputation/reputation-repository";
import { hiddenSql } from "@/server/reports/report-rules";
import { visibleToViewerSql } from "@/server/members/block-repository";

interface ProjectRow extends RowDataPacket {
  id: string;
  authorId: string;
  authorHandle: string;
  title: string;
  summary: string;
  description: string;
  status: ProjectStatus;
  technologies: string | string[];
  repositoryUrl: string | null;
  demoUrl: string | null;
  roles: string | ProjectRole[];
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  hidden: number;
}

interface LockedProject extends RowDataPacket {
  internalId: number;
  authorId: string;
  deletedAt: Date | null;
}

export interface PublicProject {
  id: string;
  authorId: string | null;
  authorHandle: string | null;
  title: string;
  summary: string | null;
  description: string | null;
  status: ProjectStatus | null;
  technologies: string[];
  roles: ProjectRole[];
  repositoryUrl: string | null;
  demoUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
  deleted: boolean;
}

const projection = `SELECT p.public_id AS id,
  m.public_id AS authorId, profile.handle AS authorHandle,
  p.title, p.summary, p.description, p.status, p.technologies,
  p.repository_url AS repositoryUrl, p.demo_url AS demoUrl, p.recruitment_roles AS roles,
  p.created_at AS createdAt, p.updated_at AS updatedAt,
  p.deleted_at AS deletedAt,
  ${hiddenSql("project", "p")} AS hidden
  FROM member_projects p
  JOIN members m ON m.id = p.member_id
  JOIN member_profiles profile ON profile.member_id = m.id`;

function present(row: ProjectRow): PublicProject {
  if (row.deletedAt) return {
    id: row.id, authorId: null, authorHandle: null,
    title: "Projet supprimé", summary: null, description: null,
    status: null, technologies: [], roles: [], repositoryUrl: null, demoUrl: null,
    createdAt: row.createdAt, updatedAt: row.updatedAt, deleted: true,
  };
  return {
    id: row.id, authorId: row.authorId, authorHandle: row.authorHandle,
    title: row.title, summary: row.summary, description: row.description,
    status: row.status,
    roles: typeof row.roles === "string" ? JSON.parse(row.roles) as ProjectRole[] : row.roles,
    technologies: typeof row.technologies === "string"
      ? JSON.parse(row.technologies) as string[] : row.technologies,
    repositoryUrl: row.repositoryUrl, demoUrl: row.demoUrl,
    createdAt: row.createdAt, updatedAt: row.updatedAt, deleted: false,
  };
}

export async function getProject(
  connection: PoolConnection, id: string, viewerId: string | null = null,
): Promise<PublicProject | null> {
  const [rows] = await connection.execute<ProjectRow[]>(
    `${projection} WHERE p.public_id = ?
       AND ${visibleToViewerSql("p.member_id")} LIMIT 1`, [id, viewerId, viewerId],
  );
  return rows[0] && !rows[0].hidden
    ? present(rows[0])
    : null;
}

export async function listProjects(connection: PoolConnection,
  viewerId: string | null = null): Promise<PublicProject[]> {
  const [rows] = await connection.execute<ProjectRow[]>(
    `${projection} WHERE p.deleted_at IS NULL
     AND ${visibleToViewerSql("p.member_id")}
     AND NOT ${hiddenSql("project", "p")}
     ORDER BY p.created_at DESC, p.id DESC LIMIT 20`, [viewerId, viewerId],
  );
  return rows.map(present);
}

export async function listMemberProjects(
  connection: PoolConnection, handle: string,
  viewerId: string | null = null,
): Promise<PublicProject[]> {
  const [rows] = await connection.execute<ProjectRow[]>(
    `${projection} WHERE profile.handle = ? AND p.deleted_at IS NULL
     AND ${visibleToViewerSql("p.member_id")}
     AND NOT ${hiddenSql("project", "p")}
     ORDER BY p.created_at DESC, p.id DESC LIMIT 20`, [handle, viewerId, viewerId],
  );
  return rows.map(present);
}

export async function createProject(
  connection: PoolConnection, authorId: string, input: ProjectInput,
): Promise<PublicProject> {
  input = parseProjectInput(input);
  const id = randomUUID();
  await connection.beginTransaction();
  try {
    const [result] = await connection.execute<ResultSetHeader>(
      `INSERT INTO member_projects
       (public_id, member_id, title, summary, description, status,
        technologies, repository_url, demo_url, recruitment_roles, created_at, updated_at)
       SELECT ?, m.id, ?, ?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3)
       FROM members m
       JOIN member_profiles profile ON profile.member_id = m.id
JOIN member_private_identities private_identity ON private_identity.member_id = m.id
       WHERE m.public_id = ?`,
      [id, input.title, input.summary, input.description, input.status,
        JSON.stringify(input.technologies), input.repositoryUrl, input.demoUrl,
        JSON.stringify(input.roles ?? []), authorId],
    );
    if (result.affectedRows !== 1) throw new TypeError("Compte incomplet.");
    const [authors] = await connection.execute<(RowDataPacket & { id: number })[]>(
      "SELECT id FROM members WHERE public_id = ?", [authorId],
    );
    await awardActivity(connection, authors[0].id, "project", result.insertId);
    await connection.commit();
  } catch (error) { await connection.rollback(); throw error; }
  const project = await getProject(connection, id);
  if (!project) throw new Error("Projet introuvable après création.");
  return project;
}


export type ProjectMutation = "ok" | "not_found" | "forbidden";

async function lockProject(
  connection: PoolConnection, id: string,
): Promise<LockedProject | null> {
  const [rows] = await connection.execute<LockedProject[]>(
    `SELECT p.id AS internalId, m.public_id AS authorId,
            p.deleted_at AS deletedAt
     FROM member_projects p JOIN members m ON m.id = p.member_id
     WHERE p.public_id = ? FOR UPDATE`, [id],
  );
  return rows[0] ?? null;
}

export async function updateProject(
  connection: PoolConnection, id: string, authorId: string,
  input: ProjectInput,
): Promise<ProjectMutation> {
  input = parseProjectInput(input);
  await connection.beginTransaction();
  try {
    const project = await lockProject(connection, id);
    if (!project || project.deletedAt) {
      await connection.rollback(); return "not_found";
    }
    if (project.authorId !== authorId) {
      await connection.rollback(); return "forbidden";
}
    await connection.execute(
      `UPDATE member_projects
       SET title = ?, summary = ?, description = ?, status = ?,
           technologies = ?, repository_url = ?, demo_url = ?, recruitment_roles = COALESCE(?, recruitment_roles),
           updated_at = UTC_TIMESTAMP(3)
       WHERE id = ? AND deleted_at IS NULL`,
      [input.title, input.summary, input.description, input.status,
        JSON.stringify(input.technologies), input.repositoryUrl,
        input.demoUrl, input.roles === undefined ? null : JSON.stringify(input.roles), project.internalId],
    );
    await connection.commit();
    return "ok";
  } catch (error) { await connection.rollback(); throw error; }
}

export async function deleteProject(
  connection: PoolConnection, id: string, authorId: string,
): Promise<ProjectMutation> {
  await connection.beginTransaction();
  try {
    const project = await lockProject(connection, id);
    if (!project || project.deletedAt) {
      await connection.rollback(); return "not_found";
    }
    if (project.authorId !== authorId) {
      await connection.rollback(); return "forbidden";
    }
    await connection.execute(
      `UPDATE member_projects
       SET deleted_at = UTC_TIMESTAMP(3), updated_at = UTC_TIMESTAMP(3)
       WHERE id = ? AND deleted_at IS NULL`, [project.internalId],
    );
    await connection.commit();
    return "ok";
  } catch (error) { await connection.rollback(); throw error; }
}
