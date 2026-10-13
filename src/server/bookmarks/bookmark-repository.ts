import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import { validBookmark, type BookmarkKind } from "@/modules/bookmarks/domain/bookmark-input";
import { pageResult, pageWindow } from "@/shared/domain/pagination";
import { hiddenSql } from "@/server/reports/report-rules";

const tables = {
  post: { content: "posts", saved: "post_bookmarks", key: "post_id" },
  project: { content: "member_projects", saved: "project_bookmarks", key: "project_id" },
} as const;

export async function getBookmark(
  connection: PoolConnection, kind: BookmarkKind, id: string, viewerId: string,
): Promise<boolean | null> {
  if (!validBookmark(kind, id)) throw new TypeError("Contenu invalide.");
  const table = tables[kind];
  const [rows] = await connection.execute<(RowDataPacket & { saved: number })[]>(
    `SELECT EXISTS (SELECT 1 FROM ${table.saved} b JOIN members m ON m.id = b.member_id
       WHERE b.${table.key} = p.id AND m.public_id = ?) AS saved
     FROM ${table.content} p WHERE p.public_id = ? AND p.deleted_at IS NULL
       AND NOT ${hiddenSql(kind, "p")}`, [viewerId, id],
  );
  return rows[0] ? Boolean(rows[0].saved) : null;
}

export async function setBookmark(
  connection: PoolConnection, kind: BookmarkKind, id: string, viewerId: string, saved: boolean,
): Promise<"ok" | "not_found"> {
  if (!validBookmark(kind, id)) throw new TypeError("Contenu invalide.");
  const table = tables[kind];
  await connection.beginTransaction();
  try {
    const [content] = await connection.execute<(RowDataPacket & { id: number; deleted: number; hidden: number })[]>(
      `SELECT p.id, p.deleted_at IS NOT NULL AS deleted, ${hiddenSql(kind, "p")} AS hidden
       FROM ${table.content} p WHERE p.public_id = ? FOR UPDATE`, [id],
    );
    if (!content[0] || (saved && (content[0].deleted || content[0].hidden))) {
      await connection.rollback(); return "not_found";
    }
    const [members] = await connection.execute<(RowDataPacket & { id: number })[]>(
      `SELECT m.id FROM members m JOIN member_profiles p ON p.member_id = m.id
       WHERE m.public_id = ?`, [viewerId],
    );
    if (!members[0]) { await connection.rollback(); return "not_found"; }
    if (saved) {
      await connection.execute(`INSERT INTO ${table.saved} (member_id, ${table.key}, created_at)
        VALUES (?, ?, UTC_TIMESTAMP(3)) ON DUPLICATE KEY UPDATE member_id = member_id`,
      [members[0].id, content[0].id]);
    } else {
      await connection.execute(`DELETE FROM ${table.saved} WHERE member_id = ? AND ${table.key} = ?`,
        [members[0].id, content[0].id]);
    }
    await connection.commit(); return "ok";
  } catch (error) { await connection.rollback(); throw error; }
}

export interface SavedContent {
  kind: BookmarkKind; id: string; title: string; authorHandle: string; savedAt: Date;
}

export async function listBookmarks(connection: PoolConnection, viewerId: string, page: number) {
  const windowSql = pageWindow(page);
  const [rows] = await connection.execute<(RowDataPacket & SavedContent)[]>(
    `SELECT 'post' AS kind, p.public_id AS id, p.title, profile.handle AS authorHandle, b.created_at AS savedAt
     FROM post_bookmarks b JOIN members viewer ON viewer.id = b.member_id
     JOIN posts p ON p.id = b.post_id JOIN member_profiles profile ON profile.member_id = p.member_id
     WHERE viewer.public_id = ? AND p.deleted_at IS NULL AND NOT ${hiddenSql("post", "p")}
     UNION ALL
     SELECT 'project' AS kind, p.public_id AS id, p.title, profile.handle AS authorHandle, b.created_at AS savedAt
     FROM project_bookmarks b JOIN members viewer ON viewer.id = b.member_id
     JOIN member_projects p ON p.id = b.project_id JOIN member_profiles profile ON profile.member_id = p.member_id
     WHERE viewer.public_id = ? AND p.deleted_at IS NULL AND NOT ${hiddenSql("project", "p")}
     ORDER BY savedAt DESC, kind ASC, id ASC ${windowSql}`, [viewerId, viewerId],
  );
  return pageResult(rows, page);
}
