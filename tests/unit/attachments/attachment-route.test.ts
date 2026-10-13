import { NextRequest } from "next/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), getConnection: vi.fn(), release: vi.fn(), list: vi.fn(), add: vi.fn(), get: vi.fn(), remove: vi.fn(), upload: vi.fn() }));
vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/server/auth/db", () => ({ authPool: () => ({ getConnection: mocks.getConnection }) }));
vi.mock("@/server/attachments/attachment-repository", () => ({ listAttachments: mocks.list, addAttachments: mocks.add, getAttachment: mocks.get, removeAttachment: mocks.remove }));
vi.mock("@/server/attachments/upload-body", async (original) => ({ ...await original<object>(), uploadBody: mocks.upload }));
import { GET, POST } from "@/app/api/attachments/[kind]/[id]/route";
import { GET as DOWNLOAD, DELETE } from "@/app/api/attachments/[kind]/[id]/[attachmentId]/route";
import { UploadTooLarge } from "@/server/attachments/upload-body";
const id = "11111111-1111-4111-8111-111111111111", attachmentId = "22222222-2222-4222-8222-222222222222";
const url = `http://localhost:3000/api/attachments/post/${id}`;
const context = (kind = "post", contentId = id) => ({ params: Promise.resolve({ kind, id: contentId, attachmentId }) });
const connection = { release: mocks.release };
const request = (method = "POST", origin = "http://localhost:3000") => new NextRequest(url, { method, headers: { origin } });
beforeEach(() => {
  vi.resetAllMocks(); vi.stubEnv("AUTH_URL", "http://localhost:3000");
  mocks.auth.mockResolvedValue({ user: { id: "owner", onboarded: true } });
  mocks.getConnection.mockResolvedValue(connection); mocks.upload.mockResolvedValue(["file"]);
  mocks.add.mockResolvedValue("ok"); mocks.remove.mockResolvedValue("ok"); mocks.list.mockResolvedValue([]);
  mocks.get.mockResolvedValue({ id: attachmentId, filename: "guide é.pdf", mimeType: "application/pdf", size: 3, data: Buffer.from("pdf") });
});
afterEach(() => vi.unstubAllEnvs());
it("refuse origine, anonymat et profil incomplet avant de lire les fichiers", async () => {
  expect((await POST(request("POST", "https://other.test"), context())).status).toBe(403);
  mocks.auth.mockResolvedValue(null);
  expect((await POST(request(), context())).status).toBe(401);
  expect((await DELETE(request("DELETE"), context())).status).toBe(401);
  mocks.auth.mockResolvedValue({ user: { id: "owner", onboarded: false } });
  expect((await POST(request(), context())).status).toBe(403);
  expect(mocks.upload).not.toHaveBeenCalled(); expect(mocks.getConnection).not.toHaveBeenCalled();
});
it("valide les identifiants et types avant MySQL", async () => {
  expect((await GET(request("GET"), context("post", "incorrect"))).status).toBe(404);
  expect((await GET(request("GET"), context("members"))).status).toBe(400);
  expect(mocks.getConnection).not.toHaveBeenCalled();
});
it("permet la liste publique sans données binaires", async () => {
  mocks.auth.mockResolvedValue(null);
  const response = await GET(request("GET"), context());
  expect(await response.json()).toEqual([]);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(mocks.auth).toHaveBeenCalledOnce();
  expect(mocks.list).toHaveBeenCalledWith(connection, "post", id, null);
});
it.each([["not_found", 404], ["forbidden", 403], ["limit", 409], ["ok", 201]])("traduit l'ajout %s en %s", async (result, status) => {
  mocks.add.mockResolvedValue(result);
  expect((await POST(request(), context())).status).toBe(status);
  expect(mocks.add).toHaveBeenCalledWith(connection, "post", id, "owner", ["file"]);
  expect(mocks.release).toHaveBeenCalledOnce();
});
it("renvoie 413 pour un flux excessif avant MySQL", async () => {
  mocks.upload.mockRejectedValue(new UploadTooLarge());
  expect((await POST(request(), context())).status).toBe(413);
  expect(mocks.getConnection).not.toHaveBeenCalled();
});
it("sert les documents en téléchargement avec nom UTF-8 et sans cache", async () => {
  const response = await DOWNLOAD(new NextRequest(url + `/${attachmentId}?view=1`), context());
  expect(response.headers.get("content-disposition")).toMatch(/^attachment;/);
  expect(response.headers.get("content-disposition")).toContain("%C3%A9");
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  expect(await response.text()).toBe("pdf");
  expect(mocks.get).toHaveBeenCalledWith(connection, "post", id, attachmentId, "owner");
});
it("autorise l'aperçu uniquement pour une image", async () => {
  mocks.get.mockResolvedValue({ id: attachmentId, filename: "image.png", mimeType: "image/png", size: 3, data: Buffer.from("png") });
  const response = await DOWNLOAD(new NextRequest(url + `/${attachmentId}?view=1`), context());
  expect(response.headers.get("content-disposition")).toMatch(/^inline;/);
});
it("renvoie 404 sans octets pour un fichier inaccessible", async () => {
  mocks.get.mockResolvedValue(null);
  const response = await DOWNLOAD(new NextRequest(url + `/${attachmentId}`), context());
  expect(response.status).toBe(404);
  expect(await response.json()).toEqual({ error: "Fichier introuvable." });
});
it("utilise la session pour supprimer et libère la connexion", async () => {
  expect((await DELETE(request("DELETE"), context())).status).toBe(204);
  expect(mocks.remove).toHaveBeenCalledWith(connection, "post", id, attachmentId, "owner");
  expect(mocks.release).toHaveBeenCalledOnce();
});
