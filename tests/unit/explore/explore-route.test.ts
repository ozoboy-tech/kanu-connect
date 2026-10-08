import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getConnection: vi.fn(), search: vi.fn(), connection: { release: vi.fn() },
}));
vi.mock("@/server/auth/db", () => ({
  authPool: () => ({ getConnection: mocks.getConnection }),
}));
vi.mock("@/server/explore/explore-repository", () => ({ searchExplore: mocks.search }));
import { GET } from "@/app/api/explore/route";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getConnection.mockResolvedValue(mocks.connection);
  mocks.search.mockResolvedValue({ kind: "members", items: [], page: 1, hasNext: false });
});
const request = (query = "") => new Request(`http://localhost:3000/api/explore?${query}`);

it("autorise la lecture publique sans cache et libère la connexion", async () => {
  const response = await GET(request("skill=React"));
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(await response.json()).toEqual({ kind: "members", items: [], page: 1, hasNext: false });
  expect(mocks.search).toHaveBeenCalledWith(mocks.connection, expect.objectContaining({ skill: "React" }));
  expect(mocks.connection.release).toHaveBeenCalledOnce();
});

it("valide les filtres avant d’ouvrir une connexion", async () => {
  expect((await GET(request("q=a&q=b"))).status).toBe(400);
  expect(mocks.getConnection).not.toHaveBeenCalled();
  expect(mocks.search).not.toHaveBeenCalled();
});

it("libère la connexion et masque les détails d’une erreur SQL", async () => {
  mocks.search.mockRejectedValue(new Error("password=secret SELECT private_email"));
  const response = await GET(request());
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({ error: "Recherche temporairement indisponible." });
  expect(mocks.connection.release).toHaveBeenCalledOnce();
});

it("gère aussi une connexion indisponible", async () => {
  mocks.getConnection.mockRejectedValue(new Error("secret"));
  expect((await GET(request())).status).toBe(503);
  expect(mocks.search).not.toHaveBeenCalled();
});
