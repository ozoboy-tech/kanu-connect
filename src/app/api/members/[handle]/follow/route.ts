import type { NextRequest } from "next/server";

import { auth } from "@/auth";
import { normalizeHandle } from "@/modules/members/domain/choose-handle";
import { authPool } from "@/server/auth/db";
import { failure, publicError, sameOrigin } from "@/server/auth/http";
import { getFollowStats, setFollow } from "@/server/members/follow-repository";

type Context = { params: Promise<{ handle: string }> };

async function handleOf(context: Context): Promise<string | null> {
  try { return normalizeHandle((await context.params).handle); }
  catch { return null; }
}

export async function GET(_request: NextRequest, context: Context): Promise<Response> {
  const handle = await handleOf(context);
  if (!handle) return failure("Profil introuvable.", 404);
  try {
    const session = await auth();
    const connection = await authPool().getConnection();
    try {
      const stats = await getFollowStats(connection, handle, session?.user.id ?? null);
      return stats ? Response.json(stats, { headers: { "Cache-Control": "no-store" } })
        : failure("Profil introuvable.", 404);
    } finally { connection.release(); }
  } catch (error) { return publicError(error); }
}

async function change(
  request: NextRequest, context: Context, follow: boolean,
): Promise<Response> {
  if (!sameOrigin(request)) return failure("Origine refusée.", 403);
  const handle = await handleOf(context);
  if (!handle) return failure("Profil introuvable.", 404);
  try {
    const session = await auth();
    if (!session?.user?.id) return failure("Connexion requise.", 401);
    if (!session.user.onboarded) return failure("Profil à compléter.", 403);
    const connection = await authPool().getConnection();
    try {
      const result = await setFollow(connection, handle, session.user.id, follow);
      if (result === "not_found") return failure("Profil introuvable.", 404);
      if (result === "self") return failure("Impossible de s’abonner à soi-même.", 403);
      const stats = await getFollowStats(connection, handle, session.user.id);
      return stats ? Response.json(stats, { headers: { "Cache-Control": "no-store" } })
        : failure("Profil introuvable.", 404);
    } finally { connection.release(); }
  } catch (error) { return publicError(error); }
}

export async function PUT(request: NextRequest, context: Context): Promise<Response> {
  return change(request, context, true);
}

export async function DELETE(request: NextRequest, context: Context): Promise<Response> {
  return change(request, context, false);
}
