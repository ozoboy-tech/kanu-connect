import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import { pageResult, pageWindow } from "@/shared/domain/pagination";
import { hiddenSql } from "@/server/reports/report-rules";

export interface ProfileActivity {
  kind: "post" | "project" | "comment";
  id: string;
  targetId: string;
  title: string;
  createdAt: Date;
}

export async function listProfileActivity(connection: PoolConnection, handle: string, page: number) {
  const windowSql = pageWindow(page);
  const [rows] = await connection.execute<(RowDataPacket & ProfileActivity)[]>(
    `SELECT 'post' AS kind, p.public_id AS id, p.public_id AS targetId, p.title, p.created_at AS createdAt
     FROM posts p JOIN member_profiles profile ON profile.member_id = p.member_id
     WHERE profile.handle = ? AND p.deleted_at IS NULL AND NOT ${hiddenSql("post", "p")}
     UNION ALL
     SELECT 'project' AS kind, p.public_id AS id, p.public_id AS targetId, p.title, p.created_at AS createdAt
     FROM member_projects p JOIN member_profiles profile ON profile.member_id = p.member_id
     WHERE profile.handle = ? AND p.deleted_at IS NULL AND NOT ${hiddenSql("project", "p")}
     UNION ALL
     SELECT 'comment' AS kind, c.public_id AS id, p.public_id AS targetId, p.title, c.created_at AS createdAt
     FROM post_comments c JOIN posts p ON p.id = c.post_id
     JOIN member_profiles profile ON profile.member_id = c.member_id
     WHERE profile.handle = ? AND c.deleted_at IS NULL AND p.deleted_at IS NULL
       AND NOT ${hiddenSql("comment", "c")} AND NOT ${hiddenSql("post", "p")}
     ORDER BY createdAt DESC, kind ASC, id ASC ${windowSql}`, [handle, handle, handle],
  );
  return pageResult(rows, page);
}
