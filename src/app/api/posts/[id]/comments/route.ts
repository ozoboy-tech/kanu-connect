import type { NextRequest } from "next/server";

import { auth } from "@/auth";
import { parseCommentInput } from "@/modules/comments/domain/comment-input";
import { validPostId } from "@/modules/posts/domain/post-input";
import { authPool } from "@/server/auth/db";
import { bodyOf, failure, publicError, sameOrigin } from "@/server/auth/http";
import { createComment, listComments } from "@/server/comments/comment-repository";
import { getPost } from "@/server/posts/post-repository";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: Context): Promise<Response> {
  const { id } = await context.params;
  if (!validPostId(id)) return failure("Publication introuvable.", 404);
  try {
    const connection = await authPool().getConnection();
    try {
      if (!await getPost(connection, id)) return failure("Publication introuvable.", 404);
      return Response.json(await listComments(connection, id), {
        headers: { "Cache-Control": "no-store" },
      });
    } finally { connection.release(); }
  } catch (error) { return publicError(error); }
}

export async function POST(request: NextRequest, context: Context): Promise<Response> {
  if (!sameOrigin(request)) return failure("Origine refusée.", 403);
  const { id } = await context.params;
  if (!validPostId(id)) return failure("Publication introuvable.", 404);
  try {
    const session = await auth();
    if (!session?.user?.id) return failure("Connexion requise.", 401);
    if (!session.user.onboarded) return failure("Profil à compléter.", 403);
    const input = parseCommentInput(await bodyOf(request));
    const connection = await authPool().getConnection();
    try {
      return Response.json(
        await createComment(connection, id, session.user.id, input),
        { status: 201 },
      );
    } finally { connection.release(); }
  } catch (error) {
    if (error instanceof TypeError && error.message === "Publication indisponible.") {
      return failure(error.message, 409);
    }
    return publicError(error);
  }
}
