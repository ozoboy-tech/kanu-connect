import type { NextRequest } from "next/server";
import { auth } from "@/auth";
import { validPostId } from "@/modules/posts/domain/post-input";
import { authPool } from "@/server/auth/db";
import { bodyOf, failure, publicError, sameOrigin } from "@/server/auth/http";
import {
  listDiscussionMessages, sendDiscussionMessage,
} from "@/server/projects/discussion-repository";

type Context = { params: Promise<{ id: string }> };

async function handle(request: NextRequest, context: Context): Promise<Response> {
  let response: Response;
  try { response = await execute(request, context); }
  catch (error) { response = publicError(error); }
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

async function execute(request: NextRequest, context: Context): Promise<Response> {
  if (request.method === "POST" && !sameOrigin(request)) {
    return failure("Origine refusée.", 403);
  }
  const { id } = await context.params;
  if (!validPostId(id)) return failure("Discussion inaccessible.", 404);
  const session = await auth();
  if (!session?.user?.id) return failure("Connexion requise.", 401);
  if (!session.user.onboarded) return failure("Profil à compléter.", 403);
  const body = request.method === "POST" ? await bodyOf(request, 16384) : null;
  if (body && Object.keys(body).some((key) => key !== "message")) {
    return failure("Champs invalides.", 400);
  }
  const connection = await authPool().getConnection();
  try {
    if (request.method === "GET") {
      const page = await listDiscussionMessages(
        connection, id, session.user.id, request.nextUrl.searchParams.get("before"),
      );
      return page ? Response.json(page) : failure("Discussion inaccessible.", 404);
    }
    const result = await sendDiscussionMessage(connection, id, session.user.id, body?.message);
    return result === "ok" ? Response.json({ ok: true }, { status: 201 })
      : failure("Discussion inaccessible.", 404);
  } finally { connection.release(); }
}

export { handle as GET, handle as POST };
