import { NextRequest } from "next/server";
import { beforeEach, afterEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(), getConnection: vi.fn(), release: vi.fn(), get: vi.fn(), save: vi.fn(),
}));
vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/server/auth/db", () => ({
  authPool: () => ({ getConnection: mocks.getConnection }),
}));
vi.mock("@/server/notifications/notification-preferences", () => ({
  getNotificationPreferences: mocks.get, saveNotificationPreferences: mocks.save,
}));

import { GET, PUT } from "@/app/api/me/notifications/route";
import { defaultNotificationPreferences } from "@/modules/notifications/domain/notification-input";

const url = "http://localhost:3000/api/me/notifications";
const connection = { release: mocks.release };
const put = (body: unknown, origin = "http://localhost:3000") => new NextRequest(url, {
  method: "PUT", headers: { origin, "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("AUTH_URL", "http://localhost:3000");
  mocks.auth.mockResolvedValue({ user: { id: "viewer", onboarded: true } });
  mocks.getConnection.mockResolvedValue(connection);
  mocks.get.mockResolvedValue(defaultNotificationPreferences);
  mocks.save.mockResolvedValue(defaultNotificationPreferences);
});
afterEach(() => vi.unstubAllEnvs());

it("ne lit et ne modifie que les préférences de la session", async () => {
  expect((await GET(new NextRequest(`${url}?memberId=other`))).status).toBe(200);
  expect(mocks.get).toHaveBeenCalledWith(connection, "viewer");
  const response = await PUT(put(defaultNotificationPreferences));
  expect(response.status).toBe(200);
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  expect(mocks.save).toHaveBeenCalledWith(connection, "viewer", defaultNotificationPreferences);
  expect(mocks.release).toHaveBeenCalledTimes(2);
});

it("rejette origine, anonymat et champs non reconnus avant MySQL", async () => {
  expect((await PUT(put(defaultNotificationPreferences, "https://evil.test"))).status).toBe(403);
  expect((await PUT(put({ ...defaultNotificationPreferences, memberId: "other" }))).status).toBe(400);
  mocks.auth.mockResolvedValue(null);
  expect((await GET(new NextRequest(url))).status).toBe(401);
  expect(mocks.getConnection).not.toHaveBeenCalled();
});
