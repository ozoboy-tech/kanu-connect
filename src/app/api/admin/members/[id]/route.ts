import type { NextRequest } from "next/server";
import { auth } from "@/auth";
import { validPostId } from "@/modules/posts/domain/post-input";
import { authPool } from "@/server/auth/db";
import { bodyOf, failure, publicError, sameOrigin } from "@/server/auth/http";
import { isAdmin } from "@/server/moderation/moderator";
import { administerAccount, parseAdminAction } from "@/server/accounts/admin-repository";

type Context = { params: Promise<{ id: string }> };
export async function POST(request: NextRequest, context: Context): Promise<Response> {
  if (!sameOrigin(request)) return failure("Origine refusée.", 403);
  const { id } = await context.params;
  if (!validPostId(id)) return failure("Compte introuvable.", 404);
  try {
    const session = await auth();
    if (!session?.user.id) return failure("Connexion requise.", 401);
    const connection = await authPool().getConnection();
    try {
      if (!await isAdmin(connection, session.user.id)) return failure("Accès refusé.", 403);
      const input = parseAdminAction(await bodyOf(request, 1024));
      const result = await administerAccount(connection, session.user.id, id, input);
      return result === "ok" ? Response.json({ ok: true },
        { headers: { "Cache-Control": "no-store" } })
        : failure(result === "forbidden" ? "Action refusée." : "Compte introuvable.",
          result === "forbidden" ? 403 : 404);
    } finally { connection.release(); }
  } catch (error) { return publicError(error); }
}
