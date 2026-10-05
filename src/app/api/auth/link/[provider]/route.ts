import type { NextRequest } from "next/server";
import { auth } from "@/auth";
import { createOAuthLinkIntent } from "@/server/auth/accounts";
import { authPool } from "@/server/auth/db";
import { failure, publicError, sameOrigin } from "@/server/auth/http";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ provider: string }> },
): Promise<Response> {
  if (!sameOrigin(request)) return failure("Origine refusée.", 403);
  const session = await auth();
  if (!session?.user?.id || !session.user.onboarded) {
    return failure("Compte complet et connexion requis.", 401);
  }
  try {
    const { provider } = await context.params;
    const enabled = provider === "google"
      ? process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET
      : provider === "github"
        ? process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET
        : provider === "gitlab"
          ? process.env.AUTH_GITLAB_ID && process.env.AUTH_GITLAB_SECRET
          : false;
    if (!enabled) return failure("Fournisseur indisponible.", 400);
    const connection = await authPool().getConnection();
    let token: string;
    try {
      token = await createOAuthLinkIntent(connection, session.user.id, provider);
    } finally {
      connection.release();
    }
    const response = Response.json({
      signInUrl: new URL(`/api/auth/signin/${provider}`, request.url).toString(),
      message: "Ouvre signInUrl dans ce navigateur dans les 10 minutes.",
    });
    response.headers.append("Set-Cookie",
      `kanu_oauth_link=${token}; Path=/api/auth; HttpOnly; SameSite=Lax; Max-Age=600${
        new URL(process.env.AUTH_URL!).protocol === "https:" ? "; Secure" : ""
      }`);
    return response;
  } catch (error) {
    return publicError(error);
  }
}
