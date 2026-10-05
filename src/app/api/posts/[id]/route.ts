import type { NextRequest } from "next/server";

import { auth } from "@/auth";
import { parsePostInput, validPostId } from "@/modules/posts/domain/post-input";
import { authPool } from "@/server/auth/db";
import { bodyOf, failure, publicError, sameOrigin } from "@/server/auth/http";
import {
  deletePost, getPost, updatePost, type MutationResult,
} from "@/server/posts/post-repository";

type Context = { params: Promise<{ id: string }> };

function mutationFailure(result: MutationResult): Response {
  return result === "not_found" ? failure("Publication introuvable.", 404)
    : failure("Modification interdite ou délai de 15 minutes dépassé.", 403);
}

export async function GET(_request: NextRequest, context: Context): Promise<Response> {
  const { id } = await context.params;
  if (!validPostId(id)) return failure("Publication introuvable.", 404);
  try {
    const connection = await authPool().getConnection();
    try {
      const post = await getPost(connection, id);
      return post
        ? Response.json(post, { headers: { "Cache-Control": "no-store" } })
        : failure("Publication introuvable.", 404);
    } finally { connection.release(); }
  } catch (error) { return publicError(error); }
}

export async function PATCH(request: NextRequest, context: Context): Promise<Response> {
  if (!sameOrigin(request)) return failure("Origine refusée.", 403);
  const { id } = await context.params;
  if (!validPostId(id)) return failure("Publication introuvable.", 404);
  try {
    const session = await auth();
    if (!session?.user?.id) return failure("Connexion requise.", 401);
    if (!session.user.onboarded) return failure("Profil à compléter.", 403);
    const input = parsePostInput(await bodyOf(request, 16384));
    const connection = await authPool().getConnection();
    try {
      const result = await updatePost(connection, id, session.user.id, input);
      if (result !== "ok") return mutationFailure(result);
      return Response.json(await getPost(connection, id));
    } finally { connection.release(); }
  } catch (error) {
    if (error && typeof error === "object" && "code" in error &&
        error.code === "ER_DUP_ENTRY") return failure("Mots-clés en double.", 409);
    return publicError(error);
  }
}

export async function DELETE(request: NextRequest, context: Context): Promise<Response> {
  if (!sameOrigin(request)) return failure("Origine refusée.", 403);
  const { id } = await context.params;
  if (!validPostId(id)) return failure("Publication introuvable.", 404);
  try {
    const session = await auth();
    if (!session?.user?.id) return failure("Connexion requise.", 401);
    if (!session.user.onboarded) return failure("Profil à compléter.", 403);
    const connection = await authPool().getConnection();
    try {
      const result = await deletePost(connection, id, session.user.id);
      return result === "ok" ? new Response(null, { status: 204 })
        : mutationFailure(result);
    } finally { connection.release(); }
  } catch (error) { return publicError(error); }
}