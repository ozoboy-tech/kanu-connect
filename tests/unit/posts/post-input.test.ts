import { describe, expect, it } from "vitest";

import { parsePostInput, validPostId } from "@/modules/posts/domain/post-input";

const valid = {
  kind: "question", space: "questions",
  title: "  Comment utiliser TypeScript ?  ",
  body: "Voici mon problème.", code: "const n = 1;",
  codeLanguage: "TypeScript", keywords: [" TypeScript ", "Aide"],
};

describe("Saisie d'une publication", () => {
  it("normalise le titre, le langage et les mots-clés", () => {
    expect(parsePostInput(valid)).toMatchObject({
      title: "Comment utiliser TypeScript ?",
      codeLanguage: "typescript", keywords: ["typescript", "aide"],
    });
  });

  it("impose les champs requis et refuse les mots-clés répétés", () => {
    expect(() => parsePostInput({ ...valid, title: "  " })).toThrow();
    expect(() => parsePostInput({ ...valid, keywords: [] })).toThrow();
    expect(() => parsePostInput({ ...valid, keywords: ["Aide", "aide"] }))
      .toThrow();
    expect(() => parsePostInput({ ...valid, space: "inconnu" })).toThrow();
  });

  it("associe obligatoirement un langage au code", () => {
    expect(() => parsePostInput({ ...valid, codeLanguage: null })).toThrow();
    expect(() => parsePostInput({ ...valid, code: null })).toThrow();
    expect(parsePostInput({ ...valid, code: null, codeLanguage: null }).code)
      .toBeNull();
  });

  it("accepte seulement un identifiant de publication UUID", () => {
    expect(validPostId("f72bfafe-6969-424e-84ba-e48857622d33")).toBe(true);
    expect(validPostId("../../members")).toBe(false);
  });
});
