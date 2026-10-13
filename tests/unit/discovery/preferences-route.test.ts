import { NextRequest } from "next/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), getConnection: vi.fn(), release: vi.fn(), get: vi.fn(), save: vi.fn() }));
vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/server/auth/db", () => ({ authPool: () => ({ getConnection: mocks.getConnection }) }));
vi.mock("@/server/discovery/preferences-repository", () => ({ getDiscoveryPreferences: mocks.get, saveDiscoveryPreferences: mocks.save }));
import { GET, PUT } from "@/app/api/me/discovery/route";
const prefs = { topics: ["react"], welcomeCompleted: true, tourCompleted: false, remindersEnabled: false };
const connection = { release: mocks.release };
const request = (value: unknown = prefs, origin = "http://localhost:3000") => new NextRequest("http://localhost:3000/api/me/discovery", {
  method: "PUT", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(value),
});
beforeEach(() => {
  vi.resetAllMocks(); vi.stubEnv("AUTH_URL", "http://localhost:3000");
  mocks.auth.mockResolvedValue({ user: { id: "viewer", onboarded: true } });
  mocks.getConnection.mockResolvedValue(connection); mocks.get.mockResolvedValue(prefs); mocks.save.mockResolvedValue(prefs);
});
afterEach(() => vi.unstubAllEnvs());
it("réserve les préférences au membre connecté", async () => {
  expect((await GET(request())).status).toBe(200);
  expect(mocks.get).toHaveBeenCalledWith(connection, "viewer");
  mocks.auth.mockResolvedValue(null); expect((await GET(request())).status).toBe(401);
});
it("refuse origine, profil incomplet et identité fournie par le client", async () => {
  expect((await PUT(request(prefs, "https://other.test"))).status).toBe(403);
  expect((await PUT(request({ ...prefs, memberId: "other" }))).status).toBe(400);
  mocks.auth.mockResolvedValue({ user: { id: "viewer", onboarded: false } });
  expect((await PUT(request())).status).toBe(403); expect(mocks.getConnection).not.toHaveBeenCalled();
});
it("enregistre les catégories facultatives et la désactivation des rappels", async () => {
  const response = await PUT(request()); expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(mocks.save).toHaveBeenCalledWith(connection, "viewer", prefs);
  expect(mocks.release).toHaveBeenCalledOnce();
});
