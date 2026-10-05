import { describe, expect, it } from "vitest";

import { parseDatabaseUrl } from
  "@/server/database/parse-database-url";

describe("Configuration de la connexion MySQL", () => {
  it("décode le mot de passe et conserve la base attendue", () => {
    expect(
      parseDatabaseUrl(
        "mysql://kanu_app_dev:un%40secret@127.0.0.1:3306/kanuconnectdev",
        "kanuconnectdev",
      ),
    ).toEqual({
      host: "127.0.0.1",
      port: 3306,
      user: "kanu_app_dev",
      password: "un@secret",
      database: "kanuconnectdev",
    });
  });

  it("utilise le port MySQL par défaut quand il est absent", () => {
    expect(
      parseDatabaseUrl(
        "mysql://kanu_app_dev:secret@127.0.0.1/kanuconnectdev",
        "kanuconnectdev",
      ).port,
    ).toBe(3306);
  });

  it("transmet une adresse IPv6 sans crochets au pilote MySQL", () => {
    const config = parseDatabaseUrl(
      "mysql://kanu_app_dev:secret@[::1]:3306/kanuconnectdev",
      "kanuconnectdev",
    );

    expect(config.host).toBe("::1");
  });

  it.each([
    undefined,
    "",
    "postgresql://kanu_app_dev:secret@127.0.0.1/kanuconnectdev",
    "mysql://root:secret@127.0.0.1/kanuconnectdev",
    "mysql://kanu_migrate_dev:secret@127.0.0.1/kanuconnectdev",
    "mysql://kanu_app_dev@127.0.0.1/kanuconnectdev",
    "mysql://kanu_app_dev:secret@127.0.0.1/kanuconnecttest",
    "mysql://kanu_app_dev:secret@127.0.0.1/",
  ])("rejette une configuration absente ou dangereuse : %s", (url) => {
    expect(() => {
      parseDatabaseUrl(url, "kanuconnectdev");
    }).toThrow(TypeError);
  });

  it("ne révèle jamais le mot de passe dans une erreur", () => {
    try {
      parseDatabaseUrl(
        "mysql://root:supersecret@127.0.0.1/kanuconnectdev",
        "kanuconnectdev",
      );

      throw new Error("La configuration aurait dû être rejetée.");
    } catch (error) {
      expect(error).toBeInstanceOf(TypeError);
      expect((error as Error).message).not.toContain("supersecret");
    }
  });
});