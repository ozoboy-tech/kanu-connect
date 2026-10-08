import { expect, it } from "vitest";
import {
  parseDiscussionCursor, parseDiscussionMessage,
} from "@/modules/projects/domain/discussion-input";

it("nettoie le message et conserve les retours à la ligne", () => {
  expect(parseDiscussionMessage("  Bonjour\nÀ demain.  ")).toBe("Bonjour\nÀ demain.");
  expect(parseDiscussionMessage("x".repeat(2000))).toHaveLength(2000);
});

it.each([undefined, null, 12, {}, "", " \n ", "x".repeat(2001)])(
  "refuse un message invalide : %j", (value) => {
    expect(() => parseDiscussionMessage(value)).toThrow(TypeError);
  },
);

it("conserve le texte HTML comme texte", () => {
  expect(parseDiscussionMessage("<b>Bonjour</b>")).toBe("<b>Bonjour</b>");
});

it("valide le curseur sans arrondir les grands identifiants", () => {
  expect(parseDiscussionCursor(null)).toBeNull();
  expect(parseDiscussionCursor("18446744073709551615")).toBe("18446744073709551615");
  for (const value of ["0", "-1", "01", "1.5", "1 OR 1=1", "18446744073709551616"]) {
    expect(() => parseDiscussionCursor(value)).toThrow(TypeError);
  }
});
