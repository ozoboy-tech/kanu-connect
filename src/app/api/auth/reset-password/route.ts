import type { NextRequest } from "next/server";
import { consumeEmailToken } from "@/server/auth/accounts";
import { authPool } from "@/server/auth/db";
import { bodyOf, failure, publicError, sameOrigin, textField } from "@/server/auth/http";

export async function POST(request: NextRequest): Promise<Response> {
  if (!sameOrigin(request)) return failure("Origine refusée.", 403);
  try {
    const data = await bodyOf(request);
    const connection = await authPool().getConnection();
    try {
      if (!await consumeEmailToken(
        connection, textField(data.token), "reset", textField(data.password),
      )) return failure("Lien invalide ou expiré.", 400);
    } finally {
      connection.release();
    }
    return Response.json({ message: "Mot de passe modifié. Reconnecte-toi." });
  } catch (error) {
    return publicError(error);
  }
}
