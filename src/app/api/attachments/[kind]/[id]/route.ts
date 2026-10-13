import type { NextRequest } from "next/server";
import { auth } from "@/auth";
import { parseAttachmentKind } from "@/modules/attachments/domain/attachment-input";
import { validPostId } from "@/modules/posts/domain/post-input";
import { authPool } from "@/server/auth/db";
import { failure, publicError, sameOrigin } from "@/server/auth/http";
import { addAttachments, listAttachments } from "@/server/attachments/attachment-repository";
import { uploadBody, UploadTooLarge } from "@/server/attachments/upload-body";

type Context = { params: Promise<{ kind: string; id: string }> };

export async function GET(_request: NextRequest, context: Context): Promise<Response> {
  try {
    const { kind: raw, id } = await context.params;
    const kind = parseAttachmentKind(raw);
    if (!validPostId(id)) return failure("Contenu introuvable.", 404);
    const session = await auth();
    const connection = await authPool().getConnection();
    try {
      const files = await listAttachments(connection, kind, id, session?.user.id ?? null);
      return files === null ? failure("Contenu introuvable.", 404)
        : Response.json(files, { headers: { "Cache-Control": "no-store" } });
    } finally { connection.release(); }
  } catch (error) { return publicError(error); }
}

export async function POST(request: NextRequest, context: Context): Promise<Response> {
  if (!sameOrigin(request)) return failure("Origine refusée.", 403);
  try {
    const { kind: raw, id } = await context.params;
    const kind = parseAttachmentKind(raw);
    if (!validPostId(id)) return failure("Contenu introuvable.", 404);
    const session = await auth();
    if (!session?.user?.id) return failure("Connexion requise.", 401);
    if (!session.user.onboarded) return failure("Profil à compléter.", 403);
    const files = await uploadBody(request, kind);
    const connection = await authPool().getConnection();
    try {
      const result = await addAttachments(connection, kind, id, session.user.id, files);
      if (result === "not_found") return failure("Contenu introuvable.", 404);
      if (result === "forbidden") return failure("Modification non autorisée ou délai dépassé.", 403);
      if (result === "limit") return failure("Trois fichiers maximum par contenu.", 409);
      return Response.json({ ok: true }, { status: 201 });
    } finally { connection.release(); }
  } catch (error) {
    return error instanceof UploadTooLarge ? failure("Envoi trop volumineux.", 413) : publicError(error);
  }
}
