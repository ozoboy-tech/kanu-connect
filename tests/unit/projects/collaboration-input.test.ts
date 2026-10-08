import { expect, it } from "vitest";
import {
  parseCollaborationCursor, parseCollaborationDecision, parseCollaborationMessage,
} from "@/modules/projects/domain/collaboration-input";

it("normalise le message sans supprimer ses retours à la ligne", () => {
  expect(parseCollaborationMessage("  Bonjour\nJe peux aider.  "))
    .toBe("Bonjour\nJe peux aider.");
  expect(parseCollaborationMessage("x".repeat(1000))).toHaveLength(1000);
});

it.each([null, 12, {}, "  ", "x".repeat(1001)])("refuse un message invalide", (value) => {
  expect(() => parseCollaborationMessage(value)).toThrow(TypeError);
});

it("accepte uniquement les deux décisions prévues", () => {
  expect(parseCollaborationDecision("accepted")).toBe("accepted");
  expect(parseCollaborationDecision("rejected")).toBe("rejected");
  for (const value of ["pending", "admin", null]) {
    expect(() => parseCollaborationDecision(value)).toThrow(TypeError);
  }
});

it("valide les curseurs sans perte de précision", () => {
  expect(parseCollaborationCursor(null)).toBeNull();
  expect(parseCollaborationCursor("18446744073709551615"))
    .toBe("18446744073709551615");
  for (const value of ["0", "-1", "1.5", "1 OR 1=1", "18446744073709551616"]) {
    expect(() => parseCollaborationCursor(value)).toThrow(TypeError);
  }
});
