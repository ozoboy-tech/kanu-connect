import { expect, it } from "vitest";
import { parseDiscoveryPreferences } from "@/modules/discovery/domain/discovery-input";
import { parsePage, pageWindow } from "@/shared/domain/pagination";
import { exploreHref, feedHref, parseExploreQuery } from "@/modules/explore/domain/explore-query";

const prefs = { topics: [], welcomeCompleted: false, tourCompleted: false, remindersEnabled: true };
it("autorise les catégories facultatives et les normalise", () => {
  expect(parseDiscoveryPreferences(prefs)).toEqual(prefs);
  expect(parseDiscoveryPreferences({ ...prefs, topics: [" React ", "PYTHON"] }).topics).toEqual(["react", "python"]);
});
it.each([null, [], { ...prefs, memberId: "other" }, { ...prefs, remindersEnabled: "oui" },
  { ...prefs, topics: ["react", "React"] }, { ...prefs, topics: ["x"] },
  { ...prefs, topics: ["<script>"] }, { ...prefs, topics: Array.from({ length: 21 }, (_, i) => `topic${i}`) },
])("refuse les préférences mal formées : %j", (input) => {
  expect(() => parseDiscoveryPreferences(input)).toThrow(TypeError);
});
it("cumule recherche, espace, type, catégorie, tri et pagination", () => {
  const query = parseExploreQuery(new URLSearchParams({ kind: "posts", q: "MySQL", space: "questions",
    type: "question", keyword: "mysql", sort: "popular", feed: "foryou", page: "2" }));
  expect(parseExploreQuery(new URL(exploreHref(query), "http://localhost").searchParams)).toEqual(query);
  const url = new URL(feedHref(query, 3), "http://localhost");
  expect(url.pathname).toBe("/feed"); expect(url.searchParams.has("kind")).toBe(false);
  expect(url.searchParams.get("page")).toBe("3");
});
it.each(["kind=posts&sort=unanswered&type=tip", "kind=posts&sort=unanswered&space=sharing",
  "kind=projects&sort=unanswered", "kind=members&sort=popular", "kind=posts&skill=React",
  "kind=posts&space=unknown", "kind=posts&feed=unknown", "kind=projects&feed=foryou",
  "kind=posts&keyword=" + "x".repeat(33), "kind=posts&sort=recent&sort=popular",
])("refuse les filtres incompatibles : %s", (raw) => {
  expect(() => parseExploreQuery(new URLSearchParams(raw))).toThrow(TypeError);
});
it("borne aussi la pagination utilisée directement par les repositories", () => {
  expect(parsePage(null)).toBe(1); expect(pageWindow(2)).toBe("LIMIT 21 OFFSET 20");
  for (const page of [0, -1, 1.5, NaN, 1001]) expect(() => pageWindow(page)).toThrow(TypeError);
  for (const raw of ["", "01", "-1", "1 OR 1=1"]) expect(() => parsePage(raw)).toThrow(TypeError);
});
