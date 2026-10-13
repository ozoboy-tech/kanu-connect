import type { NextRequest } from "next/server";
import { auth } from "@/auth";
import { normalizeHandle } from "@/modules/members/domain/choose-handle";
import { authPool } from "@/server/auth/db";
import { failure, publicError, sameOrigin } from "@/server/auth/http";
import { blockState, setBlock } from "@/server/members/block-repository";

type Context = { params: Promise<{ handle: string }> };
async function nameOf(context: Context): Promise<string | null> {
  try { return normalizeHandle((await context.params).handle); } catch { return null; }
}

export async function GET(_request: NextRequest, context: Context): Promise<Response> {
  const handle = await nameOf(context);
  if (!handle) return failure("Profil introuvable.", 404);
  try {
    const session = await auth();
    if (!session?.user.onboarded) return failure("Connexion requise.", 401);
    const connection = await authPool().getConnection();
    try {
      const state = await blockState(connection, session.user.id, handle);
      return state ? Response.json({ blockedByMe: state.blockedByMe },
        { headers: { "Cache-Control": "no-store" } })
        : failure("Profil introuvable.", 404);
    } finally { connection.release(); }
  } catch (error) { return publicError(error); }
}

async function change(request: NextRequest, context: Context, block: boolean): Promise<Response> {
  if (!sameOrigin(request)) return failure("Origine refusée.", 403);
  const handle = await nameOf(context);
  if (!handle) return failure("Profil introuvable.", 404);
  try {
    const session = await auth();
    if (!session?.user.onboarded) return failure("Connexion requise.", 401);
    const connection = await authPool().getConnection();
    try {
      const result = await setBlock(connection, session.user.id, handle, block);
      if (result === "not_found") return failure("Profil introuvable.", 404);
      if (result === "self") return failure("Action impossible sur soi-même.", 403);
      return Response.json({ blockedByMe: block },
        { headers: { "Cache-Control": "no-store" } });
    } finally { connection.release(); }
  } catch (error) { return publicError(error); }
}
export async function PUT(request: NextRequest, context: Context): Promise<Response> {
  return change(request, context, true);
}
export async function DELETE(request: NextRequest, context: Context): Promise<Response> {
  return change(request, context, false);
}
