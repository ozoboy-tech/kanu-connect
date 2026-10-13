import type { NextRequest } from "next/server";
import { auth } from "@/auth";
import { parseNotificationPreferences } from "@/modules/notifications/domain/notification-input";
import { authPool } from "@/server/auth/db";
import { bodyOf, failure, publicError, sameOrigin } from "@/server/auth/http";
import {
  getNotificationPreferences, saveNotificationPreferences,
} from "@/server/notifications/notification-preferences";

async function handle(request: NextRequest, change: boolean): Promise<Response> {
  let response: Response;
  try { response = await execute(request, change); }
  catch (error) { response = publicError(error); }
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

async function execute(request: NextRequest, change: boolean): Promise<Response> {
  if (change && !sameOrigin(request)) return failure("Origine refusée.", 403);
  const session = await auth();
  if (!session?.user?.id) return failure("Connexion requise.", 401);
  if (!session.user.onboarded) return failure("Profil à compléter.", 403);
  const input = change ? parseNotificationPreferences(await bodyOf(request)) : null;
  const connection = await authPool().getConnection();
  try {
    const result = change
      ? await saveNotificationPreferences(connection, session.user.id, input)
      : await getNotificationPreferences(connection, session.user.id);
    return result ? Response.json(result) : failure("Profil introuvable.", 404);
  } finally { connection.release(); }
}

export async function GET(request: NextRequest) { return handle(request, false); }
export async function PUT(request: NextRequest) { return handle(request, true); }
