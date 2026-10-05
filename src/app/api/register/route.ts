import type { NextRequest } from "next/server";
import { registerEmail, allowAuthAttempt } from "@/server/auth/accounts";
import { authPool } from "@/server/auth/db";
import { bodyOf, failure, optionalHandle, publicError, sameOrigin, textField } from "@/server/auth/http";
import { sendAuthMail } from "@/server/auth/mailer";

export async function POST(request: NextRequest): Promise<Response> {
  if (!sameOrigin(request)) return failure("Origine refusée.", 403);
  try {
    const data = await bodyOf(request);
    const email = textField(data.email);
    const connection = await authPool().getConnection();
    let issued: { email: string; token: string };
    try {
      if (!await allowAuthAttempt(connection, "register", email, 5)) {
        return failure("Trop de demandes.", 429);
      }
      issued = await registerEmail(connection, {
        email, password: textField(data.password),
        legalName: textField(data.legalName),
        handle: optionalHandle(data.handle),
      });
    } finally {
      connection.release();
    }
    await sendAuthMail(issued.email, "verify", issued.token);
    return Response.json({ message: "Vérifie ton adresse e-mail." }, { status: 201 });
  } catch (error) {
    return publicError(error);
  }
}
