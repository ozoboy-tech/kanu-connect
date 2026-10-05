import type { NextRequest } from "next/server";

import { auth } from "@/auth";
import { parseProfileUpdate } from "@/modules/members/domain/profile-input";
import { authPool } from "@/server/auth/db";
import { bodyOf, failure, publicError, sameOrigin } from "@/server/auth/http";
import { getOwnProfile, updateOwnProfile } from "@/server/members/profile-repository";

export async function GET(): Promise<Response> {
  try {
    const session = await auth();
    if (!session?.user?.id) return failure("Connexion requise.", 401);
    if (!session.user.onboarded) return failure("Profil à compléter.", 403);
    const connection = await authPool().getConnection();
    try {
      const profile = await getOwnProfile(connection, session.user.id);
      return profile
        ? Response.json(profile, { headers: { "Cache-Control": "no-store" } })
        : failure("Profil introuvable.", 404);
    } finally { connection.release(); }
  } catch (error) { return publicError(error); }
}

export async function PATCH(request: NextRequest): Promise<Response> {
  if (!sameOrigin(request)) return failure("Origine refusée.", 403);
  try {
    const session = await auth();
    if (!session?.user?.id) return failure("Connexion requise.", 401);
    if (!session.user.onboarded) return failure("Profil à compléter.", 403);
    const input = parseProfileUpdate(await bodyOf(request, 8192));
    const connection = await authPool().getConnection();
    try {
      const profile = await updateOwnProfile(connection, session.user.id, input);
      return profile
        ? Response.json(profile, { headers: { "Cache-Control": "no-store" } })
        : failure("Profil introuvable.", 404);
    } finally { connection.release(); }
  } catch (error) {
    if (error && typeof error === "object" && "code" in error &&
        error.code === "ER_DUP_ENTRY") {
      return failure("Pseudo ou libellé indisponible.", 409);
    }
    return publicError(error);
  }
}