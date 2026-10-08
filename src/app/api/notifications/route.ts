import type { NextRequest } from "next/server";
import { auth } from "@/auth";
import { parseNotificationId } from "@/modules/notifications/domain/notification-input";
import { authPool } from "@/server/auth/db";
import { bodyOf, failure, publicError, sameOrigin } from "@/server/auth/http";
import {
  listNotifications, markNotificationRead,
} from "@/server/notifications/notification-repository";

async function handle(request: NextRequest): Promise<Response> {
  let response: Response;
  try { response = await execute(request); }
  catch (error) { response = publicError(error); }
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

async function execute(request: NextRequest): Promise<Response> {
  if (request.method === "PATCH" && !sameOrigin(request)) {
    return failure("Origine refusée.", 403);
  }
  const session = await auth();
  if (!session?.user?.id) return failure("Connexion requise.", 401);
  if (!session.user.onboarded) return failure("Profil à compléter.", 403);
  let id: string | null = null;
  let before: string | null = null;
  if (request.method === "PATCH") {
    const body = await bodyOf(request);
    if (typeof body.id !== "string" || Object.keys(body).some((key) => key !== "id")) {
      return failure("Champs invalides.", 400);
    }
    id = parseNotificationId(body.id);
  } else {
    before = parseNotificationId(request.nextUrl.searchParams.get("before"));
  }
  const connection = await authPool().getConnection();
  try {
    if (request.method === "GET") {
      return Response.json(await listNotifications(connection, session.user.id, before));
    }
    const result = await markNotificationRead(connection, session.user.id, id!);
    return result === "ok" ? Response.json({ ok: true })
      : failure("Notification introuvable.", 404);
  } finally { connection.release(); }
}

export { handle as GET, handle as PATCH };
