import type { NextRequest } from "next/server";

import { auth } from "@/auth";
import { validPostId } from
  "@/modules/posts/domain/post-input";
import { authPool } from "@/server/auth/db";
import {
  bodyOf,
  failure,
  publicError,
  sameOrigin,
} from "@/server/auth/http";
import { isModerator } from
  "@/server/moderation/moderator";
import {
  reviewContent,
  type ModerationDecision,
} from "@/server/moderation/moderation-repository";
import {
  reportKinds,
  type ReportKind,
} from "@/server/reports/report-rules";

type Context = {
  params: Promise<{
    kind: string;
    id: string;
  }>;
};

export async function POST(
  request: NextRequest,
  context: Context,
): Promise<Response> {
  if (!sameOrigin(request)) {
    return failure("Origine refusée.", 403);
  }

  const { kind, id } = await context.params;

  if (
    !reportKinds.includes(kind as ReportKind) ||
    !validPostId(id)
  ) {
    return failure("Contenu introuvable.", 404);
  }

  try {
    const session = await auth();

    if (!session?.user.id) {
      return failure("Connexion requise.", 401);
    }

    if (!isModerator(session.user.id)) {
      return failure("Accès refusé.", 403);
    }

    const { decision, note } = await bodyOf(
      request,
      1024,
    );

    if (
      decision !== "hide" &&
      decision !== "restore"
    ) {
      return failure("Décision invalide.", 400);
    }

    if (
      typeof note !== "string" ||
      note.trim().length > 500
    ) {
      return failure("Note invalide.", 400);
    }

    const connection = await authPool().getConnection();

    try {
      const result = await reviewContent(
        connection,
        kind as ReportKind,
        id,
        session.user.id,
        decision as ModerationDecision,
        note.trim(),
      );

      if (result === "not_found") {
        return failure("Signalement introuvable.", 404);
      }

      if (result === "forbidden") {
        return failure("Accès refusé.", 403);
      }

      return Response.json(
        { decision },
        {
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    } finally {
      connection.release();
    }
  } catch (error) {
    return publicError(error);
  }
}
