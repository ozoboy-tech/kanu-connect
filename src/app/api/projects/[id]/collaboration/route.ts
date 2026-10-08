import type { NextRequest } from "next/server";
import { auth } from "@/auth";
import { validPostId } from "@/modules/posts/domain/post-input";
import { authPool } from "@/server/auth/db";
import { bodyOf, failure, publicError, sameOrigin } from "@/server/auth/http";
import {
  decideCollaboration, listCollaborations, requestCollaboration,
} from "@/server/projects/collaboration-repository";

type Context = { params: Promise<{ id: string }> };

async function handle(request: NextRequest, context: Context): Promise<Response> {
  if (request.method !== "GET" && !sameOrigin(request)) {
    return failure("Origine refusée.", 403);
  }
  const { id } = await context.params;
  if (!validPostId(id)) return failure("Projet introuvable.", 404);
  try {
    const session = await auth();
    if (!session?.user?.id) return failure("Connexion requise.", 401);
    if (!session.user.onboarded) return failure("Profil à compléter.", 403);
    const body = request.method === "GET" ? null : await bodyOf(request, 8192);
    if (request.method === "POST" &&
        Object.keys(body!).some((key) => key !== "message")) {
      return failure("Champs invalides.", 400);
    }
    if (request.method === "PATCH" && (
      typeof body?.memberId !== "string" || !validPostId(body.memberId) ||
      Object.keys(body).some((key) => key !== "memberId" && key !== "decision")
    )) return failure("Champs invalides.", 400);
    const connection = await authPool().getConnection();
    try {
      if (request.method === "GET") {
        const state = await listCollaborations(
          connection, id, session.user.id, request.nextUrl.searchParams.get("before"),
        );
        return state ? Response.json(state, {
          headers: { "Cache-Control": "private, no-store" },
        }) : failure("Projet introuvable.", 404);
      }
      const result = request.method === "POST"
        ? await requestCollaboration(connection, id, session.user.id, body?.message)
        : await decideCollaboration(
            connection, id, session.user.id, body!.memberId as string, body?.decision,
          );
      if (result === "ok") return Response.json({ ok: true }, {
        status: request.method === "POST" ? 201 : 200,
      });
      if (result === "not_found") return failure("Projet ou demande introuvable.", 404);
      if (result === "forbidden") return failure("Action non autorisée.", 403);
      return failure(result === "duplicate"
        ? "Tu as déjà envoyé une demande pour ce projet."
        : "Cette demande a déjà reçu une décision.", 409);
    } finally { connection.release(); }
  } catch (error) { return publicError(error); }
}

export { handle as GET, handle as POST, handle as PATCH };
