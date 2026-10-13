import { parseExploreQuery } from "@/modules/explore/domain/explore-query";
import { authPool } from "@/server/auth/db";
import { failure } from "@/server/auth/http";
import { searchExplore } from "@/server/explore/explore-repository";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  let query;
  try { query = parseExploreQuery(new URL(request.url).searchParams); }
  catch { return failure("Filtres invalides.", 400); }
  try {
    const personal = query.feed === "following" || query.feed === "foryou";
    const session = await auth();
    if (personal && !session?.user?.id) return failure("Connexion requise.", 401);
    if (personal && !session?.user.onboarded) return failure("Profil à compléter.", 403);
    const connection = await authPool().getConnection();
    try {
      const result = await searchExplore(connection, query, session?.user.id ?? null);
      return Response.json(result, {
        headers: { "Cache-Control": "no-store" },
      });
    } finally { connection.release(); }
  } catch {
    return failure("Recherche temporairement indisponible.", 503);
  }
}
