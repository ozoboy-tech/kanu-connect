import type { PoolConnection } from "mysql2/promise";
import { expect, it, vi } from "vitest";
import { parseExploreQuery } from "@/modules/explore/domain/explore-query";
import { searchExplore } from "@/server/explore/explore-repository";

function database(rows: unknown[]) {
  const execute = vi.fn().mockResolvedValue([rows, []]);
  return { execute, connection: { execute } as unknown as PoolConnection };
}

it("retourne seulement les champs publics et garde la saisie dans les paramètres SQL", async () => {
  const db = database([{
    publicId: "public-id", handle: "awa", bio: null, location: "Bamako",
    skills: '["TypeScript","React"]', legalName: "Privé", email: "secret@example.test",
  }]);
  const query = parseExploreQuery(new URLSearchParams({ q: "' OR 1=1 -- %_!" }));
  const result = await searchExplore(db.connection, query);
  expect(result.items).toEqual([{
    publicId: "public-id", handle: "awa", bio: null, location: "Bamako", skills: ["React", "TypeScript"],
  }]);
  const [sql, values] = db.execute.mock.calls[0];
  expect(sql).not.toContain(query.q);
  expect(values).toEqual(["%' OR 1=1 -- !%!_!!%", "%' OR 1=1 -- !%!_!!%"]);
});

it("retire le résultat sentinelle et les données privées des cartes projet", async () => {
  const db = database(Array.from({ length: 21 }, (_, index) => ({
    id: String(index), authorHandle: "awa", title: "Projet", summary: "Résumé",
    status: "building", technologies: ["React"], collaboratorEmail: "secret@example.test",
  })));
  const result = await searchExplore(db.connection, parseExploreQuery(new URLSearchParams({ kind: "projects" })));
  expect(result.hasNext).toBe(true);
  expect(result.items).toHaveLength(20);
  expect(result.items[0]).toEqual({
    id: "0", authorHandle: "awa", title: "Projet", summary: "Résumé", status: "building", technologies: ["React"],
  });
});

it("refuse aussi une pagination non validée reçue directement par le repository", async () => {
  const db = database([]);
  const query = parseExploreQuery(new URLSearchParams());
  await expect(searchExplore(db.connection, { ...query, page: Number.NaN })).rejects.toThrow(TypeError);
  expect(db.execute).not.toHaveBeenCalled();
});
