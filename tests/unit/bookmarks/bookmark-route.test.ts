import { NextRequest } from "next/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), getConnection: vi.fn(), release: vi.fn(), get: vi.fn(), set: vi.fn() }));
vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/server/auth/db", () => ({ authPool: () => ({ getConnection: mocks.getConnection }) }));
vi.mock("@/server/bookmarks/bookmark-repository", () => ({ getBookmark: mocks.get, setBookmark: mocks.set }));
import { GET, PUT, DELETE } from "@/app/api/bookmarks/[kind]/[id]/route";
const id = "11111111-1111-4111-8111-111111111111";
const context = (kind = "post", contentId = id) => ({ params: Promise.resolve({ kind, id: contentId }) });
const request = (method = "PUT", origin = "http://localhost:3000") => new NextRequest(`http://localhost:3000/api/bookmarks/post/${id}`, { method, headers: { origin } });
const connection = { release: mocks.release };
beforeEach(() => {
  vi.resetAllMocks(); vi.stubEnv("AUTH_URL", "http://localhost:3000");
  mocks.auth.mockResolvedValue({ user: { id: "viewer", onboarded: true } });
  mocks.getConnection.mockResolvedValue(connection); mocks.get.mockResolvedValue(true); mocks.set.mockResolvedValue("ok");
});
afterEach(() => vi.unstubAllEnvs());
it("refuse origine, anonymat et profil incomplet avant MySQL", async () => {
  expect((await PUT(request("PUT", "https://other.test"), context())).status).toBe(403);
  mocks.auth.mockResolvedValue(null); expect((await GET(request("GET"), context())).status).toBe(401);
  mocks.auth.mockResolvedValue({ user: { id: "viewer", onboarded: false } });
  expect((await DELETE(request("DELETE"), context())).status).toBe(403);
  expect(mocks.getConnection).not.toHaveBeenCalled();
});
it("valide le contenu avant MySQL", async () => {
  expect((await PUT(request(), context("comment"))).status).toBe(404);
  expect((await PUT(request(), context("post", "bad"))).status).toBe(404);
  expect(mocks.getConnection).not.toHaveBeenCalled();
});
it("lit uniquement l'enregistrement du membre connecté sans cache", async () => {
  const response = await GET(request("GET"), context());
  expect(await response.json()).toEqual({ saved: true });
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(mocks.get).toHaveBeenCalledWith(connection, "post", id, "viewer");
  expect(mocks.release).toHaveBeenCalledOnce();
});
it("ajoute et retire avec l'identité de session", async () => {
  expect((await PUT(request(), context())).status).toBe(200);
  expect(mocks.set).toHaveBeenLastCalledWith(connection, "post", id, "viewer", true);
  expect((await DELETE(request("DELETE"), context())).status).toBe(200);
  expect(mocks.set).toHaveBeenLastCalledWith(connection, "post", id, "viewer", false);
});
it("masque un contenu supprimé ou modéré", async () => {
  mocks.get.mockResolvedValue(null); mocks.set.mockResolvedValue("not_found");
  expect((await GET(request("GET"), context())).status).toBe(404);
  expect((await PUT(request(), context())).status).toBe(404);
});
