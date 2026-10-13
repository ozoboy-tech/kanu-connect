import type { NextRequest } from "next/server";
import { auth } from "@/auth";
import { authPool } from "@/server/auth/db";
import { failure, publicError, sameOrigin } from "@/server/auth/http";
import { deactivateAccount } from "@/server/accounts/account-repository";

export async function POST(request: NextRequest): Promise<Response> {
  if (!sameOrigin(request)) return failure("Origine refusée.", 403);
  try {
    const session = await auth();
    if (!session?.user.id) return failure("Connexion requise.", 401);
    const connection = await authPool().getConnection();
    try {
      const result = await deactivateAccount(connection, session.user.id);
      return result === "ok" ? Response.json({ status: "deactivated" },
        { headers: { "Cache-Control": "no-store" } })
        : failure(result === "forbidden" ? "Transfère d'abord le rôle administrateur." :
          "Compte indisponible.", result === "forbidden" ? 403 : 404);
    } finally { connection.release(); }
  } catch (error) { return publicError(error); }
}
