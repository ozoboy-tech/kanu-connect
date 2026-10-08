import { parseExploreQuery } from "@/modules/explore/domain/explore-query";
import { authPool } from "@/server/auth/db";
import { failure } from "@/server/auth/http";
import { searchExplore } from "@/server/explore/explore-repository";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  let query;
  try { query = parseExploreQuery(new URL(request.url).searchParams); }
  catch { return failure("Filtres invalides.", 400); }
  try {
    const connection = await authPool().getConnection();
    try {
      return Response.json(await searchExplore(connection, query), {
        headers: { "Cache-Control": "no-store" },
      });
    } finally { connection.release(); }
  } catch {
    return failure("Recherche temporairement indisponible.", 503);
  }
}
