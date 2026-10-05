import type { NextRequest } from "next/server";
import { consumeEmailToken } from "@/server/auth/accounts";
import { authPool } from "@/server/auth/db";
import { failure, publicError } from "@/server/auth/http";

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const token = request.nextUrl.searchParams.get("token") ?? "";
    const connection = await authPool().getConnection();
    try {
      if (!await consumeEmailToken(connection, token, "verify")) {
        return failure("Lien invalide ou expiré.", 400);
      }
    } finally {
      connection.release();
    }
    return Response.redirect(new URL("/api/auth/signin?verified=1", request.url));
  } catch (error) {
    return publicError(error);
  }
}
