import type { NextRequest } from "next/server";
import { auth } from "@/auth";
import { authPool } from "@/server/auth/db";
import { bodyOf, failure, publicError, sameOrigin } from "@/server/auth/http";
import { deleteAccount } from "@/server/accounts/account-repository";

export async function POST(request: NextRequest): Promise<Response> {
  if (!sameOrigin(request)) return failure("Origine refusée.", 403);
  try {
    const session = await auth();
    if (!session?.user.id) return failure("Connexion requise.", 401);
    const body = await bodyOf(request, 512);
    if (typeof body.confirmation !== "string" ||
        (body.password !== null && body.password !== undefined &&
         typeof body.password !== "string")) return failure("Données invalides.", 400);
    const connection = await authPool().getConnection();
    try {
      const result = await deleteAccount(connection, session.user.id,
        typeof body.password === "string" ? body.password : null, body.confirmation);
      if (result === "forbidden") return failure("Confirmation ou mot de passe incorrect.", 403);
      if (result === "not_found") return failure("Compte indisponible.", 404);
      return Response.json({ status: "deleted" },
        { headers: { "Cache-Control": "no-store" } });
    } finally { connection.release(); }
  } catch (error) { return publicError(error); }
}
