import type { NextRequest } from "next/server";

import { auth } from "@/auth";
import { validPostId } from "@/modules/posts/domain/post-input";
import { authPool } from "@/server/auth/db";
import {
  bodyOf,
  failure,
  publicError,
  sameOrigin,
} from "@/server/auth/http";
import {
  reportKinds,
  reportReasons,
  type ReportKind,
  type ReportReason,
} from "@/server/reports/report-rules";
import {
  getReportState,
  reportContent,
} from "@/server/reports/report-repository";

type Context = {
  params: Promise<{ kind: string; id: string }>;
};

async function targetOf(context: Context): Promise<{
  kind: ReportKind;
  id: string;
} | null> {
  const { kind, id } = await context.params;

  return reportKinds.includes(kind as ReportKind) &&
    validPostId(id)
    ? { kind: kind as ReportKind, id }
    : null;
}

export async function GET(
  _request: NextRequest,
  context: Context,
): Promise<Response> {
  const target = await targetOf(context);
  if (!target) return failure("Contenu introuvable.", 404);

  try {
    const session = await auth();
    if (!session?.user.id) {
      return failure("Connexion requise.", 401);
    }
    if (!session.user.onboarded) {
      return failure("Profil à compléter.", 403);
    }

    const connection = await authPool().getConnection();

    try {
      const state = await getReportState(
        connection,
        target.kind,
        target.id,
        session.user.id,
      );

      return state
        ? Response.json(state, {
            headers: { "Cache-Control": "no-store" },
          })
        : failure("Contenu introuvable.", 404);
    } finally {
      connection.release();
    }
  } catch (error) {
    return publicError(error);
  }
}

export async function POST(
  request: NextRequest,
  context: Context,
): Promise<Response> {
  if (!sameOrigin(request)) {
    return failure("Origine refusée.", 403);
  }

  const target = await targetOf(context);
  if (!target) return failure("Contenu introuvable.", 404);

  try {
    const session = await auth();
    if (!session?.user.id) {
      return failure("Connexion requise.", 401);
    }
    if (!session.user.onboarded) {
      return failure("Profil à compléter.", 403);
    }

    const { reason } = await bodyOf(request, 256);

    if (!reportReasons.includes(reason as ReportReason)) {
      return failure("Motif invalide.", 400);
    }

    const connection = await authPool().getConnection();

    try {
      const result = await reportContent(
        connection,
        target.kind,
        target.id,
        session.user.id,
        reason as ReportReason,
      );

      if (result === "not_found") {
        return failure("Contenu introuvable.", 404);
      }
      if (result === "self") {
        return failure(
          "Signalement de son propre contenu interdit.",
          403,
        );
      }

      return Response.json(result, {
        headers: { "Cache-Control": "no-store" },
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    return publicError(error);
  }
}
