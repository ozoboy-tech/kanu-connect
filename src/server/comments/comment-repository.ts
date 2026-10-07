import { randomUUID } from "node:crypto";
import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import type { CommentInput } from "@/modules/comments/domain/comment-input";
import { awardActivity } from "@/server/reputation/reputation-repository";
import { recordUsefulActivity } from "@/server/streaks/streak-repository";

interface CommentRow extends RowDataPacket {
  id: string;
  parentId: string | null;
  authorId: string;
  authorHandle: string;
  body: string;
  depth: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

interface PostRow extends RowDataPacket {
  internalId: number;
  deletedAt: Date | null;
}

interface ParentRow extends RowDataPacket {
  internalId: number;
  postId: number;
  depth: number;
}

interface LockedComment extends RowDataPacket {
  internalId: number;
  postId: number;
  authorId: string;
  editable: number;
  deletedAt: Date | null;
}

export interface PublicComment {
  id: string;
  parentId: string | null;
  authorId: string | null;
  authorHandle: string | null;
  body: string;
  depth: number;
  createdAt: Date;
  updatedAt: Date;
  deleted: boolean;
}

const projection = `SELECT c.public_id AS id, parent.public_id AS parentId,
  m.public_id AS authorId, profile.handle AS authorHandle,
  c.body, c.depth, c.created_at AS createdAt,
  c.updated_at AS updatedAt, c.deleted_at AS deletedAt
  FROM post_comments c
  JOIN posts p ON p.id = c.post_id
  JOIN members m ON m.id = c.member_id
  JOIN member_profiles profile ON profile.member_id = m.id
  LEFT JOIN post_comments parent ON parent.id = c.parent_id`;

function present(row: CommentRow): PublicComment {
  return {
    id: row.id, parentId: row.parentId,
    authorId: row.deletedAt ? null : row.authorId,
    authorHandle: row.deletedAt ? null : row.authorHandle,
    body: row.deletedAt ? "Contenu supprimé" : row.body,
    depth: row.depth, createdAt: row.createdAt,
    updatedAt: row.updatedAt, deleted: !!row.deletedAt,
  };
}

export async function listComments(
  connection: PoolConnection, postId: string,
): Promise<PublicComment[]> {
  const [rows] = await connection.execute<CommentRow[]>(
    `${projection} WHERE p.public_id = ?
     ORDER BY c.created_at ASC, c.id ASC`,
    [postId],
  );
  return rows.map(present);
}

export async function getComment(
  connection: PoolConnection, id: string,
): Promise<PublicComment | null> {
  const [rows] = await connection.execute<CommentRow[]>(
    `${projection} WHERE c.public_id = ? LIMIT 1`, [id],
  );
  return rows[0] ? present(rows[0]) : null;
}

export async function createComment(
  connection: PoolConnection, postId: string,
  authorId: string, input: CommentInput,
): Promise<PublicComment> {
  const id = randomUUID();
  await connection.beginTransaction();
  try {
    const [posts] = await connection.execute<PostRow[]>(
      `SELECT id AS internalId, deleted_at AS deletedAt
       FROM posts WHERE public_id = ? FOR UPDATE`,
      [postId],
    );
    const post = posts[0];
    if (!post || post.deletedAt) throw new TypeError("Publication indisponible.");
    let parentInternalId: number | null = null;
    let depth = 0;
    if (input.parentId) {
      const [parents] = await connection.execute<ParentRow[]>(
        `SELECT id AS internalId, post_id AS postId, depth
         FROM post_comments WHERE public_id = ? FOR UPDATE`,
        [input.parentId],
      );
      const parent = parents[0];
      if (!parent || parent.postId !== post.internalId || parent.depth >= 4) {
        throw new TypeError("Réponse impossible à ce commentaire.");
      }
      parentInternalId = parent.internalId;
      depth = parent.depth + 1;
    }
    const [result] = await connection.execute<ResultSetHeader>(
      `INSERT INTO post_comments
       (public_id, post_id, member_id, parent_id, depth, body,
        created_at, updated_at)
       SELECT ?, ?, m.id, ?, ?, ?, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3)
       FROM members m
       JOIN member_profiles profile ON profile.member_id = m.id
       JOIN member_private_identities private_identity
         ON private_identity.member_id = m.id
       WHERE m.public_id = ?`,
      [id, post.internalId, parentInternalId, depth, input.body, authorId],
    );
    if (result.affectedRows !== 1) throw new TypeError("Compte incomplet.");
    const [authors] = await connection.execute<(RowDataPacket & { id: number })[]>(
      "SELECT id FROM members WHERE public_id = ?", [authorId],
    );
    await awardActivity(connection, authors[0].id, "comment", result.insertId);
    await recordUsefulActivity(connection, authors[0].id);
    await connection.commit();
  } catch (error) { await connection.rollback(); throw error; }
  const created = await getComment(connection, id);
  if (!created) throw new Error("Commentaire introuvable après création.");
  return created;
}

async function lockComment(
  connection: PoolConnection, postId: string, commentId: string,
): Promise<LockedComment | null> {
  const [rows] = await connection.execute<LockedComment[]>(
    `SELECT c.id AS internalId, c.post_id AS postId,
            m.public_id AS authorId, c.deleted_at AS deletedAt,
            (c.created_at >= UTC_TIMESTAMP(3) - INTERVAL 15 MINUTE) AS editable
     FROM post_comments c
     JOIN posts p ON p.id = c.post_id
     JOIN members m ON m.id = c.member_id
     WHERE p.public_id = ? AND c.public_id = ? FOR UPDATE`,
    [postId, commentId],
  );
  return rows[0] ?? null;
}

export type CommentMutation = "ok" | "not_found" | "forbidden";

export async function updateComment(
  connection: PoolConnection, postId: string, commentId: string,
  authorId: string, body: string,
): Promise<CommentMutation> {
  await connection.beginTransaction();
  try {
    const row = await lockComment(connection, postId, commentId);
    if (!row || row.deletedAt) { await connection.rollback(); return "not_found"; }
    if (row.authorId !== authorId || row.editable !== 1) {
      await connection.rollback(); return "forbidden";
    }
    const [result] = await connection.execute<ResultSetHeader>(
      `UPDATE post_comments SET body = ?, updated_at = UTC_TIMESTAMP(3)
       WHERE id = ? AND deleted_at IS NULL
         AND created_at >= UTC_TIMESTAMP(3) - INTERVAL 15 MINUTE`,
      [body, row.internalId],
    );
    if (result.affectedRows !== 1) {
      await connection.rollback(); return "forbidden";
    }
    await connection.commit();
    return "ok";
  } catch (error) { await connection.rollback(); throw error; }
}

export async function deleteComment(
  connection: PoolConnection, postId: string, commentId: string,
  authorId: string,
): Promise<CommentMutation> {
  await connection.beginTransaction();
  try {
    const row = await lockComment(connection, postId, commentId);
    if (!row || row.deletedAt) { await connection.rollback(); return "not_found"; }
    if (row.authorId !== authorId || row.editable !== 1) {
      await connection.rollback(); return "forbidden";
    }
    const [result] = await connection.execute<ResultSetHeader>(
      `UPDATE post_comments
       SET deleted_at = UTC_TIMESTAMP(3), updated_at = UTC_TIMESTAMP(3)
       WHERE id = ? AND deleted_at IS NULL
         AND created_at >= UTC_TIMESTAMP(3) - INTERVAL 15 MINUTE`,
      [row.internalId],
    );
    if (result.affectedRows !== 1) {
      await connection.rollback(); return "forbidden";
    }
    await connection.commit();
    return "ok";
  } catch (error) { await connection.rollback(); throw error; }
}
