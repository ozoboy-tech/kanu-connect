import type { NextRequest } from "next/server";

import { auth } from "@/auth";
import { parseProjectInput } from "@/modules/projects/domain/project-input";
import { authPool } from "@/server/auth/db";
import { bodyOf, failure, publicError, sameOrigin } from "@/server/auth/http";
import { createProject, listProjects } from "@/server/projects/project-repository";

export async function GET(): Promise<Response> {
  try {
    const connection = await authPool().getConnection();
    try {
      return Response.json(await listProjects(connection), {
        headers: { "Cache-Control": "no-store" },
      });
    } finally { connection.release(); }
  } catch (error) { return publicError(error); }
}

export async function POST(request: NextRequest): Promise<Response> {
  if (!sameOrigin(request)) return failure("Origine refusée.", 403);
  try {
    const session = await auth();
    if (!session?.user?.id) return failure("Connexion requise.", 401);
    if (!session.user.onboarded) return failure("Profil à compléter.", 403);
    const input = parseProjectInput(await bodyOf(request, 16384));
    const connection = await authPool().getConnection();
    try {
      return Response.json(await createProject(connection, session.user.id, input), {
        status: 201,
      });
    } finally { connection.release(); }
  } catch (error) { return publicError(error); }
}
