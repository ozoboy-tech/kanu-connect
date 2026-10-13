import type { NextRequest } from "next/server";
import { auth } from "@/auth";
import { validBookmark } from "@/modules/bookmarks/domain/bookmark-input";
import { authPool } from "@/server/auth/db";
import { failure, publicError, sameOrigin } from "@/server/auth/http";
import { getBookmark, setBookmark } from "@/server/bookmarks/bookmark-repository";

type Context = { params: Promise<{ kind: string; id: string }> };

async function handle(request: NextRequest, context: Context, saved: boolean | null) {
  if (saved !== null && !sameOrigin(request)) return failure("Origine refusée.", 403);
  const { kind, id } = await context.params;
  if (!validBookmark(kind, id)) return failure("Contenu introuvable.", 404);
  try {
    const session = await auth();
    if (!session?.user?.id) return failure("Connexion requise.", 401);
    if (!session.user.onboarded) return failure("Profil à compléter.", 403);
    const connection = await authPool().getConnection();
    try {
      if (saved === null) {
        const current = await getBookmark(connection, kind, id, session.user.id);
        return current === null ? failure("Contenu introuvable.", 404)
          : Response.json({ saved: current }, { headers: { "Cache-Control": "no-store" } });
      }
      const result = await setBookmark(connection, kind, id, session.user.id, saved);
      return result === "not_found" ? failure("Contenu introuvable.", 404)
        : Response.json({ saved }, { headers: { "Cache-Control": "no-store" } });
    } finally { connection.release(); }
  } catch (error) { return publicError(error); }
}

export async function GET(request: NextRequest, context: Context) { return handle(request, context, null); }
export async function PUT(request: NextRequest, context: Context) { return handle(request, context, true); }
export async function DELETE(request: NextRequest, context: Context) { return handle(request, context, false); }
