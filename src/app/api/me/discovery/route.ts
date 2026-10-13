import type { NextRequest } from "next/server";
import { auth } from "@/auth";
import { parseDiscoveryPreferences } from "@/modules/discovery/domain/discovery-input";
import { authPool } from "@/server/auth/db";
import { bodyOf, failure, publicError, sameOrigin } from "@/server/auth/http";
import { getDiscoveryPreferences, saveDiscoveryPreferences } from "@/server/discovery/preferences-repository";

async function handle(request: NextRequest, change: boolean) {
  if (change && !sameOrigin(request)) return failure("Origine refusée.", 403);
  try {
    const session = await auth();
    if (!session?.user?.id) return failure("Connexion requise.", 401);
    if (!session.user.onboarded) return failure("Profil à compléter.", 403);
    const input = change ? parseDiscoveryPreferences(await bodyOf(request)) : null;
    const connection = await authPool().getConnection();
    try {
      const result = input ? await saveDiscoveryPreferences(connection, session.user.id, input)
        : await getDiscoveryPreferences(connection, session.user.id);
      return result ? Response.json(result, { headers: { "Cache-Control": "no-store" } })
        : failure("Profil introuvable.", 404);
    } finally { connection.release(); }
  } catch (error) { return publicError(error); }
}

export async function GET(request: NextRequest) { return handle(request, false); }
export async function PUT(request: NextRequest) { return handle(request, true); }
