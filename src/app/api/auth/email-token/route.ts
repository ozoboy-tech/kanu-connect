import type { NextRequest } from "next/server";
import { allowAuthAttempt, issueEmailToken } from "@/server/auth/accounts";
import { authPool } from "@/server/auth/db";
import { bodyOf, failure, publicError, sameOrigin, textField } from "@/server/auth/http";
import { sendAuthMail } from "@/server/auth/mailer";

export async function POST(request: NextRequest): Promise<Response> {
  if (!sameOrigin(request)) return failure("Origine refusée.", 403);
  try {
    const data = await bodyOf(request);
    const purpose = textField(data.purpose);
    if (purpose !== "verify" && purpose !== "reset") {
      return failure("Action invalide.", 400);
    }
    const email = textField(data.email);
    const connection = await authPool().getConnection();
    let issued;
    try {
      if (!await allowAuthAttempt(connection, purpose, email, 3)) {
        return failure("Trop de demandes.", 429);
      }
      issued = await issueEmailToken(connection, email, purpose);
    } finally {
      connection.release();
    }
    if (issued) await sendAuthMail(issued.email, purpose, issued.token);
    return Response.json({ message: "Si le compte est éligible, un e-mail a été envoyé." });
  } catch (error) {
    return publicError(error);
  }
}
