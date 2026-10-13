import type { PoolConnection } from "mysql2/promise";
import { expect, it, vi } from "vitest";
import { parseExploreQuery } from "@/modules/explore/domain/explore-query";
import { searchPublications } from "@/server/discovery/publication-search";

function database(rows: unknown[] = []) {
  const execute = vi.fn().mockResolvedValue([rows, []]);
  return { execute, connection: { execute } as unknown as PoolConnection };
}
const query = (raw = "") => parseExploreQuery(new URLSearchParams(`kind=posts&${raw}`));
it("garde la recherche SQL littérale, filtre tous les contenus invisibles et borne la page", async () => {
  const db = database();
  await searchPublications(db.connection, query("q=50%25_!&space=questions&keyword=mysql&sort=unanswered&page=2"));
  const [sql, values] = db.execute.mock.calls[0];
  expect(values).toEqual([null, null, "%50!%!_!!%", "%50!%!_!!%", "%50!%!_!!%", "questions", "mysql"]);
  expect(sql).toContain("p.deleted_at IS NULL"); expect(sql).toContain("content_moderation_decisions");
  expect(sql).toContain("c.deleted_at IS NULL"); expect(sql).toContain("p.kind = 'question'");
  expect(sql).toContain("LIMIT 21 OFFSET 20"); expect(sql).not.toContain("50%_!");
});
it("ne lit pas un fil personnel sans identité", async () => {
  const db = database();
  await expect(searchPublications(db.connection, query("feed=foryou"))).rejects.toThrow(TypeError);
  await expect(searchPublications(db.connection, query("feed=following"))).rejects.toThrow(TypeError);
  expect(db.execute).not.toHaveBeenCalled();
});
it("personnalise avec l'identité transmise et retourne seulement les cartes publiques", async () => {
  const row = { id: "post", authorHandle: "awa", title: "Titre", excerpt: "Texte", kind: "tip",
    space: "sharing", createdAt: new Date(0), votes7Days: 2, matchesInterest: 1, email: "secret" };
  const db = database(Array.from({ length: 21 }, () => row));
  const result = await searchPublications(db.connection, query("feed=foryou&sort=popular"), "viewer");
  expect(result.items).toHaveLength(20); expect(result.hasNext).toBe(true);
  expect(result.items[0]).not.toHaveProperty("email"); expect(result.items[0]).not.toHaveProperty("matchesInterest");
  const [sql, values] = db.execute.mock.calls[0];
  expect(values).toEqual(["viewer", "viewer", "viewer", "viewer", "viewer", "viewer"]);
  expect(sql).toContain("matchesInterest DESC"); expect(sql).toContain("votes7Days DESC");
  expect(sql).toContain("v.active = TRUE"); expect(sql).toContain("INTERVAL 7 DAY");
});
it("réserve Abonnements aux membres suivis et à soi-même", async () => {
  const db = database(); await searchPublications(db.connection, query("feed=following"), "viewer");
  const [sql, values] = db.execute.mock.calls[0];
  expect(sql).toContain("f.follower_id = viewer.id AND f.followed_id = p.member_id");
  expect(sql).toContain("viewer.id = p.member_id"); expect(values).toEqual(["viewer", "viewer", "viewer"]);
});
