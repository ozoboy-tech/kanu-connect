import type { NextRequest } from "next/server";

import { auth } from "@/auth";
import { validPostId } from "@/modules/posts/domain/post-input";
import { parseProjectInput } from "@/modules/projects/domain/project-input";
import { authPool } from "@/server/auth/db";
import { bodyOf, failure, publicError, sameOrigin } from "@/server/auth/http";
import {
  deleteProject, getProject, updateProject, type ProjectMutation,
} from "@/server/projects/project-repository";

type Context = { params: Promise<{ id: string }> };

function mutationFailure(result: ProjectMutation): Response {
  return result === "not_found" ? failure("Projet introuvable.", 404)
    : failure("Modification réservée à l’auteur.", 403);
}

export async function GET(_request: NextRequest, context: Context): Promise<Response> {
  const { id } = await context.params;
  if (!validPostId(id)) return failure("Projet introuvable.", 404);
  try {
    const connection = await authPool().getConnection();
    try {
      const project = await getProject(connection, id);
      return project ? Response.json(project, { headers: { "Cache-Control": "no-store" } })
        : failure("Projet introuvable.", 404);
    } finally { connection.release(); }
  } catch (error) { return publicError(error); }
}

export async function PATCH(request: NextRequest, context: Context): Promise<Response> {
  if (!sameOrigin(request)) return failure("Origine refusée.", 403);
  const { id } = await context.params;
  if (!validPostId(id)) return failure("Projet introuvable.", 404);
  try {
    const session = await auth();
    if (!session?.user?.id) return failure("Connexion requise.", 401);
    if (!session.user.onboarded) return failure("Profil à compléter.", 403);
    const input = parseProjectInput(await bodyOf(request, 16384));
    const connection = await authPool().getConnection();
    try {
      const result = await updateProject(connection, id, session.user.id, input);
      return result === "ok" ? Response.json(await getProject(connection, id))
        : mutationFailure(result);
    } finally { connection.release(); }
  } catch (error) { return publicError(error); }
}

export async function DELETE(request: NextRequest, context: Context): Promise<Response> {
  if (!sameOrigin(request)) return failure("Origine refusée.", 403);
  const { id } = await context.params;
  if (!validPostId(id)) return failure("Projet introuvable.", 404);
  try {
    const session = await auth();
    if (!session?.user?.id) return failure("Connexion requise.", 401);
    const connection = await authPool().getConnection();
    try {
      const result = await deleteProject(connection, id, session.user.id);
      return result === "ok" ? new Response(null, { status: 204 })
        : mutationFailure(result);
    } finally { connection.release(); }
  } catch (error) { return publicError(error); }
}
