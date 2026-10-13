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

  it("accepte une pause et exige une démonstration pour terminer", () => {
    expect(parseProjectInput({ ...valid, status: "paused" }).status).toBe("paused");
    expect(() => parseProjectInput({ ...valid, status: "live" })).toThrow();
    expect(parseProjectInput({ ...valid, status: "live", demoUrl: "https://example.org/demo" }).status).toBe("live");
  });

  it("normalise les rôles et conserve leur état pourvu", () => {
    expect(parseProjectInput({ ...valid, roles: [{ label: "  Front   end ", filled: false }, { label: "Data", filled: true }] }).roles)
      .toEqual([{ label: "Front end", filled: false }, { label: "Data", filled: true }]);
    expect(parseProjectInput(valid).roles).toBeUndefined();
    expect(parseProjectInput(parseProjectInput(valid)).roles).toBeUndefined();
    expect(parseProjectInput({ ...valid, roles: [] }).roles).toEqual([]);
  });

  it("refuse les rôles dupliqués, excessifs ou mal formés", () => {
    for (const roles of [
      [{ label: "React", filled: false }, { label: "react", filled: true }],
      [{ label: "", filled: false }], [{ label: "React", filled: "oui" }],
      [{ label: "React", filled: false, admin: true }],
      Array.from({ length: 9 }, (_, index) => ({ label: `Rôle ${index}`, filled: false })),
    ]) expect(() => parseProjectInput({ ...valid, roles })).toThrow();
  });
});
