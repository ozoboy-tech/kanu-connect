import { NextRequest } from "next/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), getConnection: vi.fn(), release: vi.fn(), withdraw: vi.fn() }));
vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/server/auth/db", () => ({ authPool: () => ({ getConnection: mocks.getConnection }) }));
vi.mock("@/server/projects/collaboration-repository", () => ({
  listCollaborations: vi.fn(), requestCollaboration: vi.fn(), decideCollaboration: vi.fn(), withdrawCollaboration: mocks.withdraw,
}));
import { DELETE } from "@/app/api/projects/[id]/collaboration/route";
const id = "11111111-1111-4111-8111-111111111111";
const context = () => ({ params: Promise.resolve({ id }) });
const request = (origin = "http://localhost:3000") => new NextRequest(`http://localhost:3000/api/projects/${id}/collaboration`, { method: "DELETE", headers: { origin } });
beforeEach(() => {
  vi.resetAllMocks(); vi.stubEnv("AUTH_URL", "http://localhost:3000");
  mocks.auth.mockResolvedValue({ user: { id: "candidate", onboarded: true } });
  mocks.getConnection.mockResolvedValue({ release: mocks.release });
  mocks.withdraw.mockResolvedValue("ok");
});
afterEach(() => vi.unstubAllEnvs());
it("retire uniquement la demande du membre de la session sans corps JSON", async () => {
  expect((await DELETE(request(), context())).status).toBe(200);
  expect(mocks.withdraw).toHaveBeenCalledWith(expect.anything(), id, "candidate");
  expect(mocks.release).toHaveBeenCalledOnce();
});
it("refuse origine, anonymat et profil incomplet avant MySQL", async () => {
  expect((await DELETE(request("https://example.org"), context())).status).toBe(403);
  mocks.auth.mockResolvedValue(null);
  expect((await DELETE(request(), context())).status).toBe(401);
  mocks.auth.mockResolvedValue({ user: { id: "candidate", onboarded: false } });
  expect((await DELETE(request(), context())).status).toBe(403);
  expect(mocks.getConnection).not.toHaveBeenCalled();
});
it.each([["not_found", 404], ["forbidden", 403], ["conflict", 409]])("traduit %s en HTTP %s", async (result, status) => {
  mocks.withdraw.mockResolvedValue(result);
  expect((await DELETE(request(), context())).status).toBe(status);
});
