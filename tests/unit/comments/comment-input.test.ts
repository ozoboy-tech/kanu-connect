import { describe, expect, it } from "vitest";

import { parseCommentEdit, parseCommentInput } from "@/modules/comments/domain/comment-input";

describe("Saisie des commentaires", () => {
  it("normalise le texte et valide la réponse", () => {
    expect(parseCommentInput({ body: "  Bonjour  ", parentId: null }))
      .toEqual({ body: "Bonjour", parentId: null });
    expect(parseCommentInput({
      body: "Réponse", parentId: "f72bfafe-6969-424e-84ba-e48857622d33",
    }).parentId).toBeTruthy();
  });

  it("refuse les textes vides, trop longs et les parents invalides", () => {
    expect(() => parseCommentInput({ body: " ", parentId: null })).toThrow();
    expect(() => parseCommentInput({ body: "x".repeat(2001), parentId: null })).toThrow();
    expect(() => parseCommentInput({ body: "Bonjour", parentId: "../autre" })).toThrow();
    expect(() => parseCommentInput({ body: "Bonjour" })).toThrow();
  });

  it("n'autorise que le corps lors d'une édition", () => {
    expect(parseCommentEdit({ body: "  Corrigé  " })).toBe("Corrigé");
    expect(() => parseCommentEdit({ body: "Texte", parentId: null })).toThrow();
  });
});