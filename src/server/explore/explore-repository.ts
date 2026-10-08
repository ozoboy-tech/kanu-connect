import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import {
  exploreMaxPage, explorePageSize, literalContains, type ExploreQuery,
} from "@/modules/explore/domain/explore-query";
import type { ProjectStatus } from "@/modules/projects/domain/project-input";
import { hiddenSql } from "@/server/reports/report-rules";

export interface ExploreMember {
  publicId: string;
  handle: string;
  bio: string | null;
  location: string | null;
  skills: string[];
}

export interface ExploreProject {
  id: string;
  authorHandle: string;
  title: string;
  summary: string;
  status: ProjectStatus;
  technologies: string[];
}

type MemberRow = RowDataPacket & Omit<ExploreMember, "skills"> & {
  skills: string | string[];
};
type ProjectRow = RowDataPacket & Omit<ExploreProject, "technologies"> & {
  technologies: string | string[];
};

export type ExploreResult = {
  page: number;
  hasNext: boolean;
} & (
  { kind: "members"; items: ExploreMember[] } |
  { kind: "projects"; items: ExploreProject[] }
);

export async function searchExplore(
  connection: PoolConnection, query: ExploreQuery,
): Promise<ExploreResult> {
  if (!Number.isInteger(query.page) || query.page < 1 || query.page > exploreMaxPage) {
    throw new TypeError("Page invalide.");
  }
  const windowSql = `LIMIT ${explorePageSize + 1} OFFSET ${(query.page - 1) * explorePageSize}`;
  const values: string[] = [];
  const where: string[] = [];
  const pageInfo = (length: number) => ({
    page: query.page,
    hasNext: length > explorePageSize && query.page < exploreMaxPage,
  });

  if (query.kind === "members") {
    if (query.q) {
      where.push(`(CONVERT(profile.handle USING utf8mb4) COLLATE utf8mb4_0900_ai_ci
        LIKE ? ESCAPE '!' OR profile.bio LIKE ? ESCAPE '!')`);
      values.push(literalContains(query.q), literalContains(query.q));
    }
    if (query.location) {
      where.push("profile.location LIKE ? ESCAPE '!'");
      values.push(literalContains(query.location));
    }
    if (query.skill) {
      where.push(`EXISTS (SELECT 1 FROM member_profile_skills skill
        WHERE skill.member_id = m.id AND skill.label = ?)`);
      values.push(query.skill);
    }
    const [rows] = await connection.execute<MemberRow[]>(
      `SELECT m.public_id AS publicId, profile.handle, profile.bio, profile.location,
        COALESCE((SELECT JSON_ARRAYAGG(skill.label) FROM member_profile_skills skill
          WHERE skill.member_id = m.id), JSON_ARRAY()) AS skills
       FROM members m JOIN member_profiles profile ON profile.member_id = m.id
       ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
       ORDER BY profile.handle ASC, m.id ASC ${windowSql}`, values,
    );
    return { kind: "members", ...pageInfo(rows.length),
      items: rows.slice(0, explorePageSize).map((row) => ({
        publicId: row.publicId, handle: row.handle, bio: row.bio, location: row.location,
        skills: (typeof row.skills === "string" ? JSON.parse(row.skills) as string[] : row.skills)
          .sort(),
      })) };
  }

  where.push("p.deleted_at IS NULL", `NOT ${hiddenSql("project", "p")}`);
  if (query.q) {
    where.push(`(p.title LIKE ? ESCAPE '!' OR p.summary LIKE ? ESCAPE '!'
      OR p.description LIKE ? ESCAPE '!')`);
    values.push(...Array<string>(3).fill(literalContains(query.q)));
  }
  if (query.status) { where.push("p.status = ?"); values.push(query.status); }
    if (query.technology) {
    // Le formulaire et la contrainte SQL autorisent au maximum 8 technologies.
    // Comparer des chaînes SQL explicites évite les conversions implicites JSON.
    const slots = 8;
    const comparisons = Array.from({ length: slots }, (_, index) => `
      CAST(JSON_UNQUOTE(JSON_EXTRACT(p.technologies, '$[${index}]'))
        AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_0900_ai_ci
      = CAST(? AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_0900_ai_ci`);
    where.push(`(${comparisons.join(" OR ")})`);
    values.push(...Array<string>(slots).fill(query.technology));
  }
  const [rows] = await connection.execute<ProjectRow[]>(
    `SELECT p.public_id AS id, profile.handle AS authorHandle,
       p.title, p.summary, p.status, p.technologies
     FROM member_projects p JOIN member_profiles profile ON profile.member_id = p.member_id
     WHERE ${where.join(" AND ")}
     ORDER BY p.created_at DESC, p.id DESC ${windowSql}`, values,
  );
  return { kind: "projects", ...pageInfo(rows.length),
    items: rows.slice(0, explorePageSize).map((row) => ({
      id: row.id, authorHandle: row.authorHandle, title: row.title,
      summary: row.summary, status: row.status,
      technologies: typeof row.technologies === "string"
        ? JSON.parse(row.technologies) as string[] : row.technologies,
    })) };
}
