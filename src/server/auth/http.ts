import type { NextRequest } from "next/server";

export function failure(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}

export function sameOrigin(request: NextRequest): boolean {
  const configured = process.env.AUTH_URL;
  const origin = request.headers.get("origin");
  if (!configured || !origin) return false;
  try {
    return new URL(origin).origin === new URL(configured).origin;
  } catch {
    return false;
  }
}

export async function bodyOf(
  request: NextRequest,
  maxChars = 4096,
): Promise<Record<string, unknown>> {
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    throw new TypeError("JSON requis.");
  }
  const raw = await request.text();
  if (raw.length > maxChars) throw new TypeError("Requête trop volumineuse.");
  const data: unknown = JSON.parse(raw);
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new TypeError("Objet JSON requis.");
  }
  return data as Record<string, unknown>;
}

export function textField(value: unknown): string {
  if (typeof value !== "string") throw new TypeError("Champ texte requis.");
  return value;
}

export function optionalHandle(value: unknown): string | null {
  return value == null ? null : textField(value);
}

export function publicError(error: unknown): Response {
  if (error instanceof TypeError || error instanceof SyntaxError) {
    return failure("Données invalides.", 400);
  }
  if (error && typeof error === "object" && "code" in error &&
      error.code === "ER_DUP_ENTRY") {
    return failure("Adresse ou pseudo indisponible.", 409);
  }
  if (error instanceof Error && (
    error.message === "Pseudo indisponible." ||
    error.message === "Inscription OAuth indisponible." ||
    error.message === "Ce compte externe appartient déjà à un autre membre."
  )) return failure(error.message, 409);
  console.error("Erreur d'authentification", error);
  return failure("Service temporairement indisponible.", 503);
}
