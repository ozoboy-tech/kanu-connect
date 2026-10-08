import type { NextRequest } from "next/server";
import { auth } from "@/auth";
import { authPool } from "@/server/auth/db";
import {
  bodyOf, failure, publicError, sameOrigin,
} from "@/server/auth/http";
import {
  getOpportunityCategories,
  setOpportunityCategories,
} from "@/server/opportunities/opportunity-repository";

export async function GET(): Promise<Response> {
  try {
    const session = await auth();

    if (!session?.user?.id) return failure("Connexion requise.", 401);
    if (!session.user.onboarded) return failure("Profil à compléter.", 403);

    const connection = await authPool().getConnection();

    try {
      return Response.json(
        {
          categories: await getOpportunityCategories(
            connection, session.user.id,
          ),
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    } finally {
      connection.release();
    }
  } catch (error) {
    return publicError(error);
  }
}

export async function PATCH(request: NextRequest): Promise<Response> {
  if (!sameOrigin(request)) return failure("Origine refusée.", 403);

  try {
    const session = await auth();

    if (!session?.user?.id) return failure("Connexion requise.", 401);
    if (!session.user.onboarded) return failure("Profil à compléter.", 403);

    const body = await bodyOf(request, 1024);

    if (Object.keys(body).some((key) => key !== "categories")) {
      return failure("Champs invalides.", 400);
    }

    const connection = await authPool().getConnection();

    try {
      await setOpportunityCategories(
        connection, session.user.id, body.categories,
      );

      return Response.json(
        {
          categories: await getOpportunityCategories(
            connection, session.user.id,
          ),
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    } finally {
      connection.release();
    }
  } catch (error) {
    return publicError(error);
  }
}
