import { expect, it } from "vitest";
import {
  opportunityCategories,
  opportunityForPost,
  parseOpportunity,
  parseOpportunityCategories,
} from "@/modules/opportunities/domain/opportunity-input";
import { parsePostInput } from "@/modules/posts/domain/post-input";

const now = Date.parse("2030-01-01T00:00:00.000Z");

const valid = {
  category: "data-ai",
  deadline: "2030-01-02T12:00:00.000Z",
  applyUrl: " https://example.test/apply ",
};

it.each(opportunityCategories)("accepte la catégorie %s", (category) => {
  expect(parseOpportunity({ ...valid, category }, now)).toEqual({
    category,
    deadline: valid.deadline,
    applyUrl: "https://example.test/apply",
  });
});

it.each([
  "2029-12-31T23:59:59.000Z",
  "2030-01-01T00:00:00.000Z",
  "2030-02-30T00:00:00.000Z",
  "2030-01-02",
  "2030-01-02T12:00:00+01:00",
])("refuse une date limite invalide ou passée : %s", (deadline) => {
  expect(() => parseOpportunity({ ...valid, deadline }, now))
    .toThrow(TypeError);
});

it.each([
  "javascript:alert(1)",
  "data:text/html,test",
  "/apply",
  "https://user:pass@example.test",
])("refuse un lien de candidature dangereux ou incomplet : %s", (applyUrl) => {
  expect(() => parseOpportunity({ ...valid, applyUrl }, now))
    .toThrow(TypeError);
});

it("refuse les informations absentes, les champs inconnus et les liens trop longs", () => {
  expect(() => parseOpportunity(null, now)).toThrow(TypeError);
  expect(() => parseOpportunity({ ...valid, category: "unknown" }, now))
    .toThrow(TypeError);
  expect(() => parseOpportunity({ ...valid, memberId: "other" }, now))
    .toThrow(TypeError);
  expect(() => parseOpportunity({
    ...valid,
    applyUrl: `https://example.test/${"a".repeat(500)}`,
  }, now)).toThrow(TypeError);
});

it("réserve les métadonnées et l’espace aux opportunités", () => {
  expect(() => opportunityForPost({
    kind: "opportunity", space: "sharing", opportunity: valid,
  }, now)).toThrow(TypeError);

  expect(() => opportunityForPost({
    kind: "question", space: "questions", opportunity: valid,
  }, now)).toThrow(TypeError);

  expect(() => opportunityForPost({
    kind: "question", space: "opportunities",
  }, now)).toThrow(TypeError);

  expect(opportunityForPost({
    kind: "question", space: "questions",
  }, now)).toBeNull();
});

it("valide aussi les opportunités reçues par le formulaire de publication", () => {
  const post = {
    kind: "opportunity",
    space: "opportunities",
    title: "Stage Data",
    body: "Présentation",
    code: null,
    codeLanguage: null,
    keywords: ["data"],
  };

  expect(() => parsePostInput(post)).toThrow(TypeError);

  const opportunity = {
    ...valid,
    deadline: "2099-01-02T12:00:00.000Z",
  };

  expect(
    parsePostInput({ ...post, opportunity }).opportunity?.category,
  ).toBe("data-ai");
});

it("accepte zéro à huit catégories distinctes et les normalise dans l’ordre officiel", () => {
  expect(parseOpportunityCategories([])).toEqual([]);
  expect(parseOpportunityCategories(["data-ai", "frontend"]))
    .toEqual(["frontend", "data-ai"]);
  expect(parseOpportunityCategories([...opportunityCategories].reverse()))
    .toEqual(opportunityCategories);

  expect(() => parseOpportunityCategories(["frontend", "frontend"]))
    .toThrow(TypeError);
  expect(() => parseOpportunityCategories(["unknown"]))
    .toThrow(TypeError);
  expect(() => parseOpportunityCategories(null)).toThrow(TypeError);
});
