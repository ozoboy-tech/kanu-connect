import type { NextRequest } from "next/server";

import { auth } from "@/auth";
import { validPostId } from "@/modules/posts/domain/post-input";
import { authPool } from "@/server/auth/db";
import { failure, publicError, sameOrigin } from "@/server/auth/http";
import { getVoteState, setVote, voteKinds, type VoteKind } from
  "@/server/votes/vote-repository";

type Context = { params: Promise<{ kind: string; id: string }> };

async function paramsOf(
  context: Context,
): Promise<{ kind: VoteKind; id: string } | null> {
  const { kind, id } = await context.params;
  return voteKinds.includes(kind as VoteKind) && validPostId(id)
    ? { kind: kind as VoteKind, id } : null;
}

export async function GET(
  _request: NextRequest, context: Context,
): Promise<Response> {
  const params = await paramsOf(context);
  if (!params) return failure("Contenu introuvable.", 404);
  try {
    const session = await auth();
    const connection = await authPool().getConnection();
    try {
      const state = await getVoteState(
        connection, params.kind, params.id, session?.user.id ?? null,
      );
      return state
        ? Response.json(state, {
            headers: { "Cache-Control": "no-store" },
          })
        : failure("Contenu introuvable.", 404);
    } finally { connection.release(); }
  } catch (error) { return publicError(error); }
}

async function mutate(
  request: NextRequest, context: Context, active: boolean,
): Promise<Response> {
  if (!sameOrigin(request)) return failure("Origine refusée.", 403);
  const params = await paramsOf(context);
  if (!params) return failure("Contenu introuvable.", 404);
  try {
    const session = await auth();
    if (!session?.user.id) return failure("Connexion requise.", 401);
    if (!session.user.onboarded) return failure("Profil à compléter.", 403);
    const connection = await authPool().getConnection();
    try {
      const state = await setVote(
        connection, params.kind, params.id, session.user.id, active,
      );
      if (state === "not_found") {
        return failure("Contenu introuvable.", 404);
      }
      if (state === "self") {
        return failure("Vote sur son propre contenu interdit.", 403);
      }
      return Response.json(state, {
        headers: { "Cache-Control": "no-store" },
      });
    } finally { connection.release(); }
  } catch (error) { return publicError(error); }
}

export async function PUT(
  request: NextRequest, context: Context,
): Promise<Response> {
  return mutate(request, context, true);
}

export async function DELETE(
  request: NextRequest, context: Context,
): Promise<Response> {
  return mutate(request, context, false);
}
