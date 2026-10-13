import { auth } from "@/auth";
import { authPool } from "@/server/auth/db";
import { failure, publicError } from "@/server/auth/http";
import { isAdmin } from "@/server/moderation/moderator";
import { listAdminMembers } from "@/server/accounts/admin-repository";

export async function GET(): Promise<Response> {
  try {
    const session = await auth();
    if (!session?.user.id) return failure("Connexion requise.", 401);
    const connection = await authPool().getConnection();
    try {
      if (!await isAdmin(connection, session.user.id)) return failure("Accès refusé.", 403);
      return Response.json(await listAdminMembers(connection, session.user.id),
        { headers: { "Cache-Control": "no-store" } });
    } finally { connection.release(); }
  } catch (error) { return publicError(error); }
}
