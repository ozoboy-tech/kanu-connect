import type { NextRequest } from "next/server";

import { auth } from "@/auth";
import { parsePostInput, spaces, type Space } from "@/modules/posts/domain/post-input";
import { authPool } from "@/server/auth/db";
import { bodyOf, failure, publicError, sameOrigin } from "@/server/auth/http";
import { createPost, listPosts } from "@/server/posts/post-repository";

export async function GET(request: NextRequest): Promise<Response> {
  const raw = request.nextUrl.searchParams.get("space");
  if (raw !== null && !spaces.includes(raw as Space)) {
    return failure("Espace invalide.", 400);
  }
  const feed = request.nextUrl.searchParams.get("feed");
  if (feed !== null && feed !== "following") {
    return failure("Fil invalide.", 400);
  }
  try {
    const session = feed === "following" ? await auth() : null;
    if (feed === "following" && !session?.user?.id) {
      return failure("Connexion requise.", 401);
    }
    if (feed === "following" && !session?.user.onboarded) {
      return failure("Profil à compléter.", 403);
    }
    const connection = await authPool().getConnection();
    try {
      const posts = await listPosts(
        connection, raw as Space | null,
        feed === "following" ? session!.user.id : null,
      );
      return Response.json(posts, { headers: { "Cache-Control": "no-store" } });
    } finally { connection.release(); }
  } catch (error) { return publicError(error); }
}

export async function POST(request: NextRequest): Promise<Response> {
  if (!sameOrigin(request)) return failure("Origine refusée.", 403);
  try {
    const session = await auth();
    if (!session?.user?.id) return failure("Connexion requise.", 401);
    if (!session.user.onboarded) return failure("Profil à compléter.", 403);
    const input = parsePostInput(await bodyOf(request, 16384));
    const connection = await authPool().getConnection();
    try {
      const post = await createPost(connection, session.user.id, input);
      return Response.json(post, { status: 201 });
    } finally { connection.release(); }
  } catch (error) {
    if (error && typeof error === "object" && "code" in error &&
        error.code === "ER_DUP_ENTRY") return failure("Mots-clés en double.", 409);
    return publicError(error);
  }
}