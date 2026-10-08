import { expect, it } from "vitest";
import {
  exploreHref, literalContains, parseExploreQuery,
} from "@/modules/explore/domain/explore-query";

it("ouvre les membres et normalise les espaces des filtres", () => {
  expect(parseExploreQuery(new URLSearchParams())).toEqual({
    kind: "members", q: "", skill: "", location: "", technology: "", status: "", page: 1,
  });
  expect(parseExploreQuery(new URLSearchParams({
    q: "  développeur   React ", location: " Bamako ", skill: " React ", page: "2",
  }))).toMatchObject({ q: "développeur React", location: "Bamako", skill: "React", page: 2 });
});

it.each([
  "kind=posts", "page=0", "page=-1", "page=1.5", "page=1001", "page=01", "page=",
  "q=a&q=b", "memberId=secret", "kind=members&technology=React",
  "kind=projects&skill=React", "kind=projects&location=Bamako",
  "kind=projects&status=unknown", "q=%00", "q=%0A",
])("refuse les paramètres invalides : %s", (raw) => {
  expect(() => parseExploreQuery(new URLSearchParams(raw))).toThrow(TypeError);
});

it.each([
  ["q", 120], ["skill", 64], ["location", 120], ["technology", 32],
] as const)("borne la taille du filtre %s", (key, max) => {
  const params = new URLSearchParams({
    kind: key === "technology" ? "projects" : "members", [key]: "x".repeat(max),
  });
  expect(() => parseExploreQuery(params)).not.toThrow();
  params.set(key, "x".repeat(max + 1));
  expect(() => parseExploreQuery(params)).toThrow(TypeError);
});

it("préserve les filtres lors de la pagination et encode les caractères spéciaux", () => {
  const query = parseExploreQuery(new URLSearchParams({
    kind: "projects", q: "a&b", technology: "C++", status: "live",
  }));
  const url = new URL(exploreHref(query, 2), "http://localhost:3000");
  expect(parseExploreQuery(url.searchParams)).toEqual({ ...query, page: 2 });
  expect(exploreHref(query, 1)).not.toContain("page=");
});

it("traite les jokers LIKE comme du texte littéral", () => {
  expect(literalContains("50%_!" )).toBe("%50!%!_!!%");
  expect(literalContains("a'b\\c")).toBe("%a'b\\c%");
});
