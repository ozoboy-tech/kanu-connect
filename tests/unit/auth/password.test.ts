import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/server/auth/password";

describe("Mot de passe", () => {
  it("hache avec un sel aléatoire et vérifie la valeur exacte", async () => {
    const password = "MotDePasseUnique!2026";
    const first = await hashPassword(password);
    const second = await hashPassword(password);
    expect(first).not.toBe(second);
    expect(first).not.toContain(password);
    expect(await verifyPassword(password, first)).toBe(true);
    expect(await verifyPassword("AutreMotDePasse!2026", first)).toBe(false);
    expect(await verifyPassword(password, "hash corrompu")).toBe(false);
  });

  it("refuse les mots de passe courts", async () => {
    await expect(hashPassword("court")).rejects.toThrow(/12/);
  });
});
