import { NextRequest } from "next/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(), getConnection: vi.fn(), release: vi.fn(),
  list: vi.fn(), send: vi.fn(),
}));
vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/server/auth/db", () => ({
  authPool: () => ({ getConnection: mocks.getConnection }),
}));
vi.mock("@/server/projects/discussion-repository", () => ({
  listDiscussionMessages: mocks.list, sendDiscussionMessage: mocks.send,
}));

import { GET, POST } from "@/app/api/projects/[id]/discussion/route";

const id = "11111111-1111-4111-8111-111111111111";
const url = `http://localhost:3000/api/projects/${id}/discussion`;
const context = () => ({ params: Promise.resolve({ id }) });
const connection = { release: mocks.release };

function post(body: unknown, origin = "http://localhost:3000") {
  return new NextRequest(url, {
    method: "POST", headers: { "Content-Type": "application/json", origin },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("AUTH_URL", "http://localhost:3000");
  mocks.auth.mockResolvedValue({ user: { id: "viewer", onboarded: true } });
  mocks.getConnection.mockResolvedValue(connection);
  mocks.list.mockResolvedValue({ messages: [], nextCursor: null });
  mocks.send.mockResolvedValue("ok");
});
afterEach(() => vi.unstubAllEnvs());

it("refuse la lecture et l'envoi anonymes avant toute connexion MySQL", async () => {
  mocks.auth.mockResolvedValue(null);
  expect((await GET(new NextRequest(url), context())).status).toBe(401);
  expect((await POST(post({ message: "Bonjour" }), context())).status).toBe(401);
  expect(mocks.getConnection).not.toHaveBeenCalled();
});

it("refuse un profil incomplet", async () => {
  mocks.auth.mockResolvedValue({ user: { id: "viewer", onboarded: false } });
  expect((await GET(new NextRequest(url), context())).status).toBe(403);
  expect((await POST(post({ message: "Bonjour" }), context())).status).toBe(403);
  expect(mocks.getConnection).not.toHaveBeenCalled();
});

it("refuse les envois depuis une autre origine", async () => {
  expect((await POST(post({ message: "Bonjour" }, "https://example.test"), context())).status)
    .toBe(403);
  expect(mocks.send).not.toHaveBeenCalled();
});

it("renvoie 404 sans message pour une discussion inaccessible", async () => {
  mocks.list.mockResolvedValue(null);
  mocks.send.mockResolvedValue("not_found");
  for (const response of [
    await GET(new NextRequest(url), context()),
    await POST(post({ message: "Bonjour" }), context()),
  ]) {
    expect(response.status).toBe(404);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await response.json()).toEqual({ error: "Discussion inaccessible." });
  }
  expect(mocks.release).toHaveBeenCalledTimes(2);
});

it("refuse un auteur fourni par le client", async () => {
  expect((await POST(post({ message: "Bonjour", authorId: "someone" }), context())).status)
    .toBe(400);
  expect(mocks.send).not.toHaveBeenCalled();
});

it("utilise le membre de la session pour publier", async () => {
  const response = await POST(post({ message: "Bonjour" }), context());
  expect(response.status).toBe(201);
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  expect(mocks.send).toHaveBeenCalledWith(connection, id, "viewer", "Bonjour");
  expect(mocks.release).toHaveBeenCalledOnce();
});
