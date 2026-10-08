import { randomUUID } from "node:crypto";
import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import type { PostInput, Space } from "@/modules/posts/domain/post-input";
import { awardActivity } from "@/server/reputation/reputation-repository";
import { recordUsefulActivity } from "@/server/streaks/streak-repository";
import { refreshSolution } from "@/server/solutions/solution-repository";
import { hiddenSql } from "@/server/reports/report-rules";
import { notifyPublication } from "@/server/notifications/community-notifications";

interface PostRow extends RowDataPacket {
  internalId: number;
  id: string;
  authorId: string;
  authorHandle: string;
  kind: string;
  space: string;
  title: string;
  body: string;
  code: string | null;
  codeLanguage: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  hidden: number;
}


interface LockedPost extends RowDataPacket {
  internalId: number;
  authorId: string;
  editable: number;
  deletedAt: Date | null;
}

export interface PublicPost {
  id: string;
  authorId: string | null;
  authorHandle: string | null;
  kind: string;
  space: string;
  title: string;
  body: string | null;
  code: string | null;
  codeLanguage: string | null;
  keywords: string[];
  createdAt: Date;
  updatedAt: Date;
  deleted: boolean;
}

const projection = `SELECT p.id AS internalId, p.public_id AS id,
  m.public_id AS authorId, profile.handle AS authorHandle,
  p.kind, p.space, p.title, p.body, p.code,
  p.code_language AS codeLanguage, p.created_at AS createdAt,
  p.updated_at AS updatedAt, p.deleted_at AS deletedAt,
  ${hiddenSql("post", "p")} AS hidden
  FROM posts p
 JOIN members m ON m.id = p.member_id
  JOIN member_profiles profile ON profile.member_id = m.id`;

async function loadPost(connection: PoolConnection, row: PostRow): Promise<PublicPost> {
  if (row.deletedAt) {
    return {
      id: row.id, authorId: null, authorHandle: null,
      kind: row.kind, space: row.space, title: "Contenu supprimé",
      body: null, code: null, codeLanguage: null, keywords: [],
      createdAt: row.createdAt, updatedAt: row.updatedAt, deleted: true,
    };
  }
  const [tags] = await connection.execute<(RowDataPacket & { keyword: string })[]>(
    "SELECT keyword FROM post_keywords WHERE post_id = ? ORDER BY keyword",
    [row.internalId],
  );
  return {
    id: row.id, authorId: row.authorId, authorHandle: row.authorHandle,
    kind: row.kind, space: row.space, title: row.title, body: row.body,
    code: row.code, codeLanguage: row.codeLanguage,
    keywords: tags.map((tag) => tag.keyword),
    createdAt: row.createdAt, updatedAt: row.updatedAt, deleted: false,
  };
}

export async function getPost(
  connection: PoolConnection, id: string,
): Promise<PublicPost | null> {
  const [rows] = await connection.execute<PostRow[]>(
    `${projection} WHERE p.public_id = ? LIMIT 1`, [id],
  );
  return rows[0] && !rows[0].hidden
    ? loadPost(connection, rows[0])
    : null;
}

export async function listPosts(
  connection: PoolConnection, space: Space | null,
  viewerId: string | null = null,
): Promise<PublicPost[]> {
  const followingOnly = viewerId !== null;
  const [rows] = await connection.execute<PostRow[]>(
    `${projection} WHERE p.deleted_at IS NULL
     AND NOT ${hiddenSql("post", "p")}
     AND (? IS NULL OR p.space = ?)     ${followingOnly ? `AND (m.public_id = ? OR EXISTS (
       SELECT 1 FROM member_follows f
       JOIN members viewer ON viewer.id = f.follower_id
       WHERE viewer.public_id = ? AND f.followed_id = p.member_id
     ))` : ""}
     ORDER BY p.created_at DESC, p.id DESC LIMIT 20`,
    followingOnly ? [space, space, viewerId, viewerId] : [space, space],
  );
  const output: PublicPost[] = [];
  for (const row of rows) output.push(await loadPost(connection, row));
  return output;
}

export async function createPost(
  connection: PoolConnection, authorId: string, input: PostInput,
): Promise<PublicPost> {
  const id = randomUUID();
  await connection.beginTransaction();
  try {
    const [result] = await connection.execute<ResultSetHeader>(
      `INSERT INTO posts
       (public_id, member_id, kind, space, title, body, code,
        code_language, created_at, updated_at)
       SELECT ?, m.id, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3)
       FROM members m JOIN member_profiles profile ON profile.member_id = m.id
       JOIN member_private_identities private_identity
         ON private_identity.member_id = m.id
       WHERE m.public_id = ?`,
      [id, input.kind, input.space, input.title, input.body,
        input.code, input.codeLanguage, authorId],
    );
    if (result.affectedRows !== 1) throw new Error("Compte incomplet.");
    for (const keyword of input.keywords) {
      await connection.execute(
        "INSERT INTO post_keywords (post_id, keyword) VALUES (?, ?)",
        [result.insertId, keyword],
      );
    }
    const [authors] = await connection.execute<(RowDataPacket & { id: number })[]>(
      "SELECT id FROM members WHERE public_id = ?", [authorId],
    );
    await awardActivity(connection, authors[0].id, "post", result.insertId);
    await recordUsefulActivity(connection, authors[0].id);
    await notifyPublication(
      connection,
      result.insertId,
      authors[0].id,
      `${input.title}\n${input.body}`,
    );
    await connection.commit();
  } catch (error) { await connection.rollback(); throw error; }
  const created = await getPost(connection, id);
  if (!created) throw new Error("Publication introuvable après création.");
  return created;
}

async function lockPost(connection: PoolConnection, id: string): Promise<LockedPost | null> {
  const [rows] = await connection.execute<LockedPost[]>(
    `SELECT p.id AS internalId, m.public_id AS authorId,
            (p.created_at >= UTC_TIMESTAMP(3) - INTERVAL 15 MINUTE) AS editable,
            p.deleted_at AS deletedAt
     FROM posts p JOIN members m ON m.id = p.member_id
     WHERE p.public_id = ? FOR UPDATE`,
    [id],
  );
  return rows[0] ?? null;
}

export type MutationResult = "ok" | "not_found" | "forbidden";

export async function updatePost(
  connection: PoolConnection, id: string, authorId: string,
  input: PostInput,
): Promise<MutationResult> {
  await connection.beginTransaction();
  try {
    const post = await lockPost(connection, id);
    if (!post || post.deletedAt) { await connection.rollback(); return "not_found"; }
    if (post.authorId !== authorId || post.editable !== 1) {
      await connection.rollback(); return "forbidden";
    }
    const [updated] = await connection.execute<ResultSetHeader>(
      `UPDATE posts SET kind = ?, space = ?, title = ?, body = ?,
        code = ?, code_language = ?, updated_at = UTC_TIMESTAMP(3)
       WHERE id = ? AND deleted_at IS NULL
         AND created_at >= UTC_TIMESTAMP(3) - INTERVAL 15 MINUTE`,
      [input.kind, input.space, input.title, input.body,
        input.code, input.codeLanguage, post.internalId],
    );
    if (updated.affectedRows !== 1) {
      await connection.rollback(); return "forbidden";
    }
    await connection.execute("DELETE FROM post_keywords WHERE post_id = ?", [post.internalId]);
    for (const keyword of input.keywords) {
      await connection.execute(
        "INSERT INTO post_keywords (post_id, keyword) VALUES (?, ?)",
        [post.internalId, keyword],
      );
    }
    await refreshSolution(connection, post.internalId);
    await connection.commit();
    return "ok";
  } catch (error) { await connection.rollback(); throw error; }
}

export async function deletePost(
  connection: PoolConnection, id: string, authorId: string,
): Promise<MutationResult> {
  await connection.beginTransaction();
  try {
    const post = await lockPost(connection, id);
    if (!post || post.deletedAt) { await connection.rollback(); return "not_found"; }
    if (post.authorId !== authorId || post.editable !== 1) {
      await connection.rollback(); return "forbidden";
    }
    const [deleted] = await connection.execute<ResultSetHeader>(
      `UPDATE posts SET deleted_at = UTC_TIMESTAMP(3), updated_at = UTC_TIMESTAMP(3)
       WHERE id = ? AND deleted_at IS NULL
         AND created_at >= UTC_TIMESTAMP(3) - INTERVAL 15 MINUTE`,
      [post.internalId],
    );
    if (deleted.affectedRows !== 1) {
      await connection.rollback(); return "forbidden";
    }
    await refreshSolution(connection, post.internalId);
    await connection.commit();    return "ok";
  } catch (error) { await connection.rollback(); throw error; }
}