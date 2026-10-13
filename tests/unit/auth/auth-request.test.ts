import { afterEach, expect, it, vi } from "vitest";
import { submitAuthRequest } from "@/shared/http/auth-request";

afterEach(() => vi.unstubAllGlobals());

it("affiche la réponse générique du serveur après une demande d'e-mail", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ message: "Si le compte est éligible, un e-mail a été envoyé." })));
  expect(await submitAuthRequest("/api/auth/email-token", { email: "demo@example.test", purpose: "verify" })).toEqual({
    ok: true, message: "Si le compte est éligible, un e-mail a été envoyé.",
  });
});

it("conserve le refus du serveur sans le présenter comme une réussite", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ error: "Trop de demandes." }, { status: 429 })));
  expect(await submitAuthRequest("/api/register", {})).toEqual({ ok: false, message: "Trop de demandes." });
});

it("transforme la panne réseau en message réessayable", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("détail interne")));
  expect(await submitAuthRequest("/api/register", {})).toEqual({ ok: false, message: "Connexion impossible. Réessaie." });
});

it("gère une réponse HTML d'erreur sans exception de JSON", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<html>indisponible</html>", { status: 503 })));
  expect(await submitAuthRequest("/api/auth/onboard", {})).toEqual({ ok: false, message: "Action impossible. Réessaie." });
});

it.each([null, ["message"], { message: 123 }, { message: "" }])("ne présente pas une réponse mal formée comme réussite (%j)", async (data) => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(data)));
  expect(await submitAuthRequest("/api/auth/reset-password", {})).toEqual({ ok: false, message: "Réponse du service illisible. Réessaie." });
});
