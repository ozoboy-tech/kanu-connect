import { NextRequest } from "next/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(), getConnection: vi.fn(), release: vi.fn(),
  list: vi.fn(), mark: vi.fn(),
}));
vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/server/auth/db", () => ({
  authPool: () => ({ getConnection: mocks.getConnection }),
}));
vi.mock("@/server/notifications/notification-repository", () => ({
  listNotifications: mocks.list, markNotificationRead: mocks.mark,
}));

import { GET, PATCH } from "@/app/api/notifications/route";

const url = "http://localhost:3000/api/notifications";
const connection = { release: mocks.release };
function patch(body: unknown, origin = "http://localhost:3000") {
  return new NextRequest(url, {
    method: "PATCH", headers: { "Content-Type": "application/json", origin },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("AUTH_URL", "http://localhost:3000");
  mocks.auth.mockResolvedValue({ user: { id: "viewer", onboarded: true } });
  mocks.getConnection.mockResolvedValue(connection);
  mocks.list.mockResolvedValue({ notifications: [], unreadCount: 0, nextCursor: null });
  mocks.mark.mockResolvedValue("ok");
});
afterEach(() => vi.unstubAllEnvs());

it("refuse les actions anonymes", async () => {
  mocks.auth.mockResolvedValue(null);
  expect((await GET(new NextRequest(url))).status).toBe(401);
  expect((await PATCH(patch({ id: "1" }))).status).toBe(401);
  expect(mocks.getConnection).not.toHaveBeenCalled();
});

it("refuse un profil incomplet", async () => {
  mocks.auth.mockResolvedValue({ user: { id: "viewer", onboarded: false } });
  expect((await GET(new NextRequest(url))).status).toBe(403);
  expect(mocks.getConnection).not.toHaveBeenCalled();
});

it("refuse une autre origine", async () => {
  expect((await PATCH(patch({ id: "1" }, "https://example.test"))).status).toBe(403);
  expect(mocks.mark).not.toHaveBeenCalled();
});

it("refuse un destinataire fourni dans le corps", async () => {
  expect((await PATCH(patch({ id: "1", memberId: "other" }))).status).toBe(400);
  expect(mocks.mark).not.toHaveBeenCalled();
});

it("refuse les identifiants et curseurs invalides avant MySQL", async () => {
  expect((await PATCH(patch({ id: "0" }))).status).toBe(400);
  expect((await GET(new NextRequest(`${url}?before=abc`))).status).toBe(400);
  expect(mocks.getConnection).not.toHaveBeenCalled();
});

it("lit uniquement les notifications du membre connecté", async () => {
  const response = await GET(new NextRequest(`${url}?memberId=other`));
  expect(response.status).toBe(200);
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  expect(mocks.list).toHaveBeenCalledWith(connection, "viewer", null);
  expect(mocks.release).toHaveBeenCalledOnce();
});

it("marque la notification avec le membre de la session", async () => {
  const response = await PATCH(patch({ id: "123" }));
  expect(response.status).toBe(200);
  expect(mocks.mark).toHaveBeenCalledWith(connection, "viewer", "123");
  expect(mocks.release).toHaveBeenCalledOnce();
});

it("renvoie 404 pour une notification inaccessible", async () => {
  mocks.mark.mockResolvedValue("not_found");
  const response = await PATCH(patch({ id: "123" }));
  expect(response.status).toBe(404);
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  expect(await response.json()).toEqual({ error: "Notification introuvable." });
});
