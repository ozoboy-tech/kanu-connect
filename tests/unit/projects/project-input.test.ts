import { describe, expect, it } from "vitest";

import { parseProjectInput } from "@/modules/projects/domain/project-input";

const valid = {
  title: "  Mon   projet  ", summary: "  Une solution  ",
  description: "  Détails et objectifs  ", status: "building",
  technologies: [" Next.js ", "MySQL"],
  repositoryUrl: "https://github.com/example/projet", demoUrl: null,
};

describe("Présentation des projets", () => {
  it("normalise les champs et les liens HTTPS", () => {
    expect(parseProjectInput(valid)).toMatchObject({
      title: "Mon projet", summary: "Une solution",
      description: "Détails et objectifs", technologies: ["Next.js", "MySQL"],
      repositoryUrl: "https://github.com/example/projet", demoUrl: null,
    });
  });

  it("refuse les technologies dupliquées et les statuts inconnus", () => {
    expect(() => parseProjectInput({ ...valid, technologies: ["React", "react"] })).toThrow();
    expect(() => parseProjectInput({ ...valid, status: "secret" })).toThrow();
    expect(() => parseProjectInput({ ...valid, technologies: [] })).toThrow();
  });

  it("refuse les liens non HTTPS et les champs supplémentaires", () => {
    expect(() => parseProjectInput({ ...valid, demoUrl: "javascript:alert(1)" })).toThrow();
    expect(() => parseProjectInput({ ...valid, repositoryUrl: "http://example.org" })).toThrow();
    expect(() => parseProjectInput({ ...valid, admin: true })).toThrow();
  });
});
