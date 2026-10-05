import type { NextRequest } from "next/server";

import { auth } from "@/auth";
import { parseCommentEdit } from "@/modules/comments/domain/comment-input";
import { validPostId } from "@/modules/posts/domain/post-input";
import { authPool } from "@/server/auth/db";
import { bodyOf, failure, publicError, sameOrigin } from "@/server/auth/http";
import {
  deleteComment, getComment, updateComment, type CommentMutation,
} from "@/server/comments/comment-repository";

type Context = { params: Promise<{ id: string; commentId: string }> };

function failed(result: CommentMutation): Response {
  return result === "not_found" ? failure("Commentaire introuvable.", 404)
    : failure("Modification interdite ou délai de 15 minutes dépassé.", 403);
}

export async function PATCH(request: NextRequest, context: Context): Promise<Response> {
  if (!sameOrigin(request)) return failure("Origine refusée.", 403);
  const { id, commentId } = await context.params;
  if (!validPostId(id) || !validPostId(commentId)) {
    return failure("Commentaire introuvable.", 404);
  }
  try {
    const session = await auth();
    if (!session?.user?.id) return failure("Connexion requise.", 401);
    const body = parseCommentEdit(await bodyOf(request));
    const connection = await authPool().getConnection();
    try {
      const result = await updateComment(connection, id, commentId, session.user.id, body);
      return result === "ok" ? Response.json(await getComment(connection, commentId))
        : failed(result);
    } finally { connection.release(); }
  } catch (error) { return publicError(error); }
}

export async function DELETE(request: NextRequest, context: Context): Promise<Response> {
  if (!sameOrigin(request)) return failure("Origine refusée.", 403);
  const { id, commentId } = await context.params;
  if (!validPostId(id) || !validPostId(commentId)) {
    return failure("Commentaire introuvable.", 404);
  }
  try {
    const session = await auth();
    if (!session?.user?.id) return failure("Connexion requise.", 401);
    const connection = await authPool().getConnection();
    try {
      const result = await deleteComment(connection, id, commentId, session.user.id);
      return result === "ok" ? new Response(null, { status: 204 }) : failed(result);
    } finally { connection.release(); }
  } catch (error) { return publicError(error); }
}
