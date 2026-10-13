import { normalizeHandle } from "@/modules/members/domain/choose-handle";
import { authPool } from "@/server/auth/db";
import { failure, publicError } from "@/server/auth/http";
import { getPublicProfile } from "@/server/members/profile-repository";
import { auth } from "@/auth";

export async function GET(
  _request: Request,
  context: { params: Promise<{ handle: string }> },
): Promise<Response> {
  try {
    let handle: string;
    try { handle = normalizeHandle((await context.params).handle); }
    catch { return failure("Profil introuvable.", 404); }
    const session = await auth();
    const connection = await authPool().getConnection();
    try {
      const profile = await getPublicProfile(connection, handle, session?.user.id ?? null);
      return profile
        ? Response.json(profile, { headers: { "Cache-Control": "no-store" } })
        : failure("Profil introuvable.", 404);
    } finally { connection.release(); }
  } catch (error) { return publicError(error); }
}
