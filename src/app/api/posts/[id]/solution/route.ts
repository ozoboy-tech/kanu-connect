import type { NextRequest } from "next/server";

import { auth } from "@/auth";
import { validPostId } from "@/modules/posts/domain/post-input";
import { authPool } from "@/server/auth/db";
import {
  bodyOf, failure, publicError, sameOrigin,
} from "@/server/auth/http";
import {
  getSolutionState, setQuestionResolved,
} from "@/server/solutions/solution-repository";

type Context = { params: Promise<{ id: string }> };

export async function GET(
  _request: NextRequest,
  context: Context,
): Promise<Response> {
  const { id } = await context.params;
  if (!validPostId(id)) {
    return failure("Question introuvable.", 404);
  }
  try {
    const connection = await authPool().getConnection();
    try {
      const state = await getSolutionState(connection, id);
      return state
        ? Response.json(state, {
            headers: { "Cache-Control": "no-store" },
          })
        : failure("Question introuvable.", 404);
    } finally {
      connection.release();
    }
  } catch (error) {
    return publicError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  context: Context,
): Promise<Response> {
  if (!sameOrigin(request)) {
    return failure("Origine refusée.", 403);
  }
  const { id } = await context.params;
  if (!validPostId(id)) {
    return failure("Question introuvable.", 404);
  }

  try {
    const session = await auth();
    if (!session?.user.id) {
      return failure("Connexion requise.", 401);
    }
    if (!session.user.onboarded) {
      return failure("Profil à compléter.", 403);
    }
    const input = await bodyOf(request);
    if (
      typeof input.resolved !== "boolean" ||
      Object.keys(input).some((key) => key !== "resolved")
    ) {
      return failure("État de la question invalide.", 400);
    }

    const connection = await authPool().getConnection();
    try {
      const result = await setQuestionResolved(
        connection, id, session.user.id, input.resolved,
      );
      if (result === "not_found") {
        return failure("Question introuvable.", 404);
      }
      if (result === "forbidden") {
        return failure("Action réservée à l'auteur.", 403);
      }
      return Response.json(
        await getSolutionState(connection, id),
        { headers: { "Cache-Control": "no-store" } },
      );
    } finally {
      connection.release();
    }
  } catch (error) {
    return publicError(error);
  }
}
