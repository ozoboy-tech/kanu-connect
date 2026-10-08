import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  save: vi.fn(),
  read: vi.fn(),
  connection: { release: vi.fn() },
}));

vi.mock("@/auth", () => ({ auth: mocks.auth }));

vi.mock("@/server/auth/db", () => ({
  authPool: () => ({
    getConnection: async () => mocks.connection,
  }),
}));

vi.mock("@/server/opportunities/opportunity-repository", () => ({
  getOpportunityCategories: mocks.read,
  setOpportunityCategories: mocks.save,
}));

import {
  GET, PATCH,
} from "@/app/api/me/opportunity-categories/route";

afterEach(() => vi.unstubAllEnvs());

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("AUTH_URL", "http://localhost:3000");

  mocks.auth.mockResolvedValue({
    user: { id: "viewer-id", onboarded: true },
  });
  mocks.read.mockResolvedValue(["data-ai"]);
  mocks.save.mockResolvedValue(undefined);
});

function request(body: unknown, origin = "http://localhost:3000") {
  return new NextRequest(
    "http://localhost:3000/api/me/opportunity-categories",
    {
      method: "PATCH",
      headers: { origin, "content-type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}

it.each([
  [null, 401],
  [{ user: { id: "viewer-id", onboarded: false } }, 403],
])("réserve la lecture et la modification aux comptes complets : %s", async (session, status) => {
  mocks.auth.mockResolvedValue(session);

  expect((await GET()).status).toBe(status);
  expect((await PATCH(request({ categories: [] }))).status).toBe(status);
  expect(mocks.save).not.toHaveBeenCalled();
});

it("refuse une modification provenant d’une autre origine", async () => {
  expect(
    (await PATCH(request({ categories: [] }, "https://other.test"))).status,
  ).toBe(403);

  expect(mocks.save).not.toHaveBeenCalled();
});

it("refuse un identifiant de membre fourni dans le corps", async () => {
  expect(
    (await PATCH(request({
      categories: [], memberId: "another-id",
    }))).status,
  ).toBe(400);

  expect(mocks.save).not.toHaveBeenCalled();
});

it("enregistre uniquement les catégories du membre de la session", async () => {
  expect(
    (await PATCH(request({ categories: ["data-ai"] }))).status,
  ).toBe(200);

  expect(mocks.save).toHaveBeenCalledWith(
    mocks.connection, "viewer-id", ["data-ai"],
  );
  expect(mocks.connection.release).toHaveBeenCalled();
});

it("lit les préférences privées sans les mettre en cache", async () => {
  const response = await GET();

  expect(await response.json()).toEqual({ categories: ["data-ai"] });
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(mocks.read).toHaveBeenCalledWith(
    mocks.connection, "viewer-id",
  );
});
