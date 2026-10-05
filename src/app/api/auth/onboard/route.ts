import type { NextRequest } from "next/server";
import { auth } from "@/auth";
import { completeOAuthOnboarding } from "@/server/auth/accounts";
import { authPool } from "@/server/auth/db";
import { bodyOf, failure, optionalHandle, publicError, sameOrigin, textField } from "@/server/auth/http";

export async function POST(request: NextRequest): Promise<Response> {
  if (!sameOrigin(request)) return failure("Origine refusée.", 403);
  const session = await auth();
  if (!session?.user?.id) return failure("Connexion requise.", 401);
  if (session.user.onboarded) return failure("Profil déjà créé.", 409);
  try {
    const data = await bodyOf(request);
    const connection = await authPool().getConnection();
    try {
      const handle = await completeOAuthOnboarding(
        connection, session.user.id,
        textField(data.legalName), optionalHandle(data.handle),
      );
      return Response.json({ handle }, { status: 201 });
    } finally {
      connection.release();
    }
  } catch (error) {
    return publicError(error);
  }
}
