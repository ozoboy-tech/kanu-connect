import { randomUUID } from "node:crypto";
import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import { maxAttachments, validateAttachment, type AttachmentInfo, type AttachmentInput, type AttachmentKind } from "@/modules/attachments/domain/attachment-input";
import { hiddenSql } from "@/server/reports/report-rules";

type Target = RowDataPacket & { id: number; authorId: string; editable: number; hidden: number; deletedAt: Date | null };
type FileRow = RowDataPacket & AttachmentInfo & { data: Buffer };
export type AttachmentMutation = "ok" | "not_found" | "forbidden" | "limit";
const tables = { post: "posts", project: "member_projects" } as const;
const keys = { post: "post_id", project: "project_id" } as const;

async function target(connection: PoolConnection, kind: AttachmentKind, id: string, lock = false): Promise<Target | null> {
  const [rows] = await connection.execute<Target[]>(
    `SELECT p.id, m.public_id AS authorId, p.deleted_at AS deletedAt,
      ${kind === "post" ? "(p.created_at > UTC_TIMESTAMP(3) - INTERVAL 15 MINUTE)" : "1"} AS editable,
      ${hiddenSql(kind, "p")} AS hidden
     FROM ${tables[kind]} p JOIN members m ON m.id = p.member_id
     WHERE p.public_id = ?${lock ? " FOR UPDATE" : ""}`, [id],
  );
  const row = rows[0];
  return row && !row.deletedAt && !row.hidden ? row : null;
}

export async function listAttachments(connection: PoolConnection, kind: AttachmentKind, id: string): Promise<AttachmentInfo[] | null> {
  // Une transaction de lecture garde la décision de visibilité cohérente avec les métadonnées.
  await connection.beginTransaction();
  try {
    const content = await target(connection, kind, id);
    if (!content) { await connection.commit(); return null; }
    const [rows] = await connection.execute<(RowDataPacket & AttachmentInfo)[]>(
      `SELECT public_id AS id, filename, mime_type AS mimeType, byte_size AS size
       FROM content_attachments WHERE ${keys[kind]} = ? ORDER BY id`, [content.id],
    );
    await connection.commit();
    return rows.map(({ id: fileId, filename, mimeType, size }) => ({ id: fileId, filename, mimeType, size }));
  } catch (error) { await connection.rollback(); throw error; }
}

export async function getAttachment(connection: PoolConnection, kind: AttachmentKind, id: string, attachmentId: string): Promise<(AttachmentInfo & { data: Buffer }) | null> {
  await connection.beginTransaction();
  try {
    const content = await target(connection, kind, id);
    if (!content) { await connection.commit(); return null; }
    const [rows] = await connection.execute<FileRow[]>(
      `SELECT public_id AS id, filename, mime_type AS mimeType, byte_size AS size, file_data AS data
       FROM content_attachments WHERE ${keys[kind]} = ? AND public_id = ?`, [content.id, attachmentId],
    );
    await connection.commit();
    const row = rows[0];
    return row ? { id: row.id, filename: row.filename, mimeType: row.mimeType, size: row.size, data: row.data } : null;
  } catch (error) { await connection.rollback(); throw error; }
}

export async function addAttachments(connection: PoolConnection, kind: AttachmentKind, id: string, authorId: string, files: AttachmentInput[]): Promise<AttachmentMutation> {
  if (!files.length || files.length > maxAttachments) throw new TypeError("Nombre de fichiers invalide.");
  const inputs = files.map((file) => validateAttachment(file.filename, file.mimeType, file.data, kind === "project"));
  await connection.beginTransaction();
  try {
    // Verrou commun à tous les ajouts : deux requêtes ne peuvent pas dépasser le quota.
    const content = await target(connection, kind, id, true);
    let result: AttachmentMutation = "ok";
    if (!content) result = "not_found";
    else if (content.authorId !== authorId || !content.editable) result = "forbidden";
    else {
      const [rows] = await connection.execute<RowDataPacket[]>(
        `SELECT id FROM content_attachments WHERE ${keys[kind]} = ? FOR UPDATE`, [content.id],
      );
      if (rows.length + inputs.length > maxAttachments) result = "limit";
      else for (const input of inputs) {
        await connection.execute(
          `INSERT INTO content_attachments (public_id, ${keys[kind]}, filename, mime_type, byte_size, file_data, created_at)
           VALUES (?, ?, ?, ?, ?, ?, UTC_TIMESTAMP(3))`,
          [randomUUID(), content.id, input.filename, input.mimeType, input.data.byteLength, Buffer.from(input.data)],
        );
      }
    }
    await connection.commit();
    return result;
  } catch (error) { await connection.rollback(); throw error; }
}

export async function removeAttachment(connection: PoolConnection, kind: AttachmentKind, id: string, attachmentId: string, authorId: string): Promise<AttachmentMutation> {
  await connection.beginTransaction();
  try {
    const content = await target(connection, kind, id, true);
    let result: AttachmentMutation;
    if (!content) result = "not_found";
    else if (content.authorId !== authorId || !content.editable) result = "forbidden";
    else {
      const [deleted] = await connection.execute<import("mysql2/promise").ResultSetHeader>(
        `DELETE FROM content_attachments WHERE ${keys[kind]} = ? AND public_id = ?`, [content.id, attachmentId],
      );
      result = deleted.affectedRows === 1 ? "ok" : "not_found";
    }
    await connection.commit();
    return result;
  } catch (error) { await connection.rollback(); throw error; }
}
