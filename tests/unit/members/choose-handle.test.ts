import type { Connection } from "mysql2/promise";
import { describe, expect, it, vi } from "vitest";

import {
  chooseHandle,
  isHandleAvailable,
  normalizeHandle,
} from "@/modules/members/domain/choose-handle";

function fakeConnection(taken: string[] = []) {
  const execute = vi.fn(async (_sql: string, params?: unknown[]) => [
    taken.includes(params?.[0] as string) ? [{ present: 1 }] : [],
    [],
  ]);

  return {
    connection: { execute } as unknown as Connection,
    execute,
  };
}

describe("Choix du pseudo", () => {
  it("normalise un pseudo saisi avant de le vérifier", () => {
    expect(normalizeHandle("  Amadou_DEV ")).toBe("amadou_dev");
  });

  it.each(["ab", "a".repeat(31), "amadou-dev", "àmadou", "a b"])(
    "refuse le pseudo invalide %s",
    (value) => {
      expect(() => normalizeHandle(value)).toThrow("Pseudo invalide");
    },
  );

  it("vérifie la disponibilité avec un paramètre SQL", async () => {
    const { connection, execute } = fakeConnection(["amadou_dev"]);

    expect(await isHandleAvailable(connection, " Amadou_DEV ")).toBe(false);
    expect(await isHandleAvailable(connection, "autre_dev")).toBe(true);
    expect(execute).toHaveBeenCalledWith(
      expect.stringContaining("WHERE handle = ?"),
      ["amadou_dev"],
    );
  });

  it("refuse un pseudo déjà pris", async () => {
    const { connection } = fakeConnection(["amadou_dev"]);

    await expect(
      chooseHandle(connection, "Amadou_DEV"),
    ).rejects.toThrow("Pseudo indisponible");
  });

  it("génère un pseudo neutre et recommence après une collision", async () => {
    const { connection } = fakeConnection(["kanu_aaaaaaaaaaaa"]);
    const suffix = vi.fn()
      .mockReturnValueOnce("aaaaaaaaaaaa")
      .mockReturnValueOnce("bbbbbbbbbbbb");

    expect(await chooseHandle(connection, null, suffix)).toBe(
      "kanu_bbbbbbbbbbbb",
    );
    expect(suffix).toHaveBeenCalledTimes(2);
  });

  it("s'arrête après huit collisions", async () => {
    const { connection } = fakeConnection(["kanu_aaaaaaaaaaaa"]);
    const suffix = vi.fn(() => "aaaaaaaaaaaa");

    await expect(
      chooseHandle(connection, "", suffix),
    ).rejects.toThrow("Aucun pseudo disponible");
    expect(suffix).toHaveBeenCalledTimes(8);
  });
});