import type { NextRequest } from "next/server";
import { auth } from "@/auth";
import { parseAttachmentKind } from "@/modules/attachments/domain/attachment-input";
import { validPostId } from "@/modules/posts/domain/post-input";
import { authPool } from "@/server/auth/db";
import { failure, publicError, sameOrigin } from "@/server/auth/http";
import { getAttachment, removeAttachment } from "@/server/attachments/attachment-repository";

type Context = { params: Promise<{ kind: string; id: string; attachmentId: string }> };
export async function GET(request: NextRequest, context: Context): Promise<Response> {
  try {
    const { kind: raw, id, attachmentId } = await context.params;
    const kind = parseAttachmentKind(raw);
    if (!validPostId(id) || !validPostId(attachmentId)) return failure("Fichier introuvable.", 404);
    const connection = await authPool().getConnection();
    try {
      const file = await getAttachment(connection, kind, id, attachmentId);
      if (!file) return failure("Fichier introuvable.", 404);
      const inline = file.mimeType.startsWith("image/") && request.nextUrl.searchParams.get("view") === "1";
      return new Response(new Uint8Array(file.data), { headers: {
        "Content-Type": file.mimeType,
        "Content-Length": String(file.size),
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="fichier"; filename*=UTF-8''${encodeURIComponent(file.filename).replace(/['()*]/gu, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`)}`,
        "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "sandbox; default-src 'none'", "Cross-Origin-Resource-Policy": "same-origin",
      } });
    } finally { connection.release(); }
  } catch (error) { return publicError(error); }
}

export async function DELETE(request: NextRequest, context: Context): Promise<Response> {
  if (!sameOrigin(request)) return failure("Origine refusée.", 403);
  try {
    const { kind: raw, id, attachmentId } = await context.params;
    const kind = parseAttachmentKind(raw);
    if (!validPostId(id) || !validPostId(attachmentId)) return failure("Fichier introuvable.", 404);
    const session = await auth();
    if (!session?.user?.id) return failure("Connexion requise.", 401);
    if (!session.user.onboarded) return failure("Profil à compléter.", 403);
    const connection = await authPool().getConnection();
    try {
      const result = await removeAttachment(connection, kind, id, attachmentId, session.user.id);
      return result === "ok" ? new Response(null, { status: 204 })
        : failure(result === "forbidden" ? "Modification non autorisée ou délai dépassé." : "Fichier introuvable.", result === "forbidden" ? 403 : 404);
    } finally { connection.release(); }
  } catch (error) { return publicError(error); }
}
