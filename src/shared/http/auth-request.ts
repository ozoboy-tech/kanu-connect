export interface AuthRequestResult {
  ok: boolean;
  message: string;
}

export async function submitAuthRequest(
  path: string, input: Record<string, unknown>,
): Promise<AuthRequestResult> {
  try {
    const response = await fetch(path, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    const data: unknown = await response.json().catch(() => null);
    const field = response.ok ? "message" : "error";
    const unreadable = response.ok ? "Réponse du service illisible. Réessaie." : "Action impossible. Réessaie.";
    if (!data || typeof data !== "object" || Array.isArray(data)) return { ok: false, message: unreadable };
    const message = (data as Record<string, unknown>)[field];
    if (message !== undefined && (typeof message !== "string" || !message.trim())) return { ok: false, message: unreadable };
    return {
      ok: response.ok,
      message: typeof message === "string" ? message : response.ok ? "Demande enregistrée." : "Action impossible. Réessaie.",
    };
  } catch {
    return { ok: false, message: "Connexion impossible. Réessaie." };
  }
}
