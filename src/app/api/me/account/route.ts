import type { NextRequest } from "next/server";
import { auth } from "@/auth";
import { authPool } from "@/server/auth/db";
import { failure, publicError } from "@/server/auth/http";
import { getAccount } from "@/server/accounts/account-repository";
import { listMyBlocks } from "@/server/members/block-repository";
import { roleOf } from "@/server/moderation/moderator";

export async function GET(_request: NextRequest): Promise<Response> {
  try {
    const session = await auth();
    if (!session?.user.id) return failure("Connexion requise.", 401);
    const connection = await authPool().getConnection();
    try {
      const account = await getAccount(connection, session.user.id);
      if (!account || account.status !== "active") return failure("Compte indisponible.", 403);
      return Response.json({ status: account.status,
        role: await roleOf(connection, session.user.id),
        blocks: await listMyBlocks(connection, session.user.id) },
      { headers: { "Cache-Control": "no-store" } });
    } finally { connection.release(); }
  } catch (error) { return publicError(error); }
}
