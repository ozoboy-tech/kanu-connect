import { describe, expect, it } from "vitest";

import { parseProfileUpdate } from "@/modules/members/domain/profile-input";

const valid = {
  handle: "Awa_Dev",
  photoUrl: "https://example.org/avatar.png",
  bio: "  Développeuse   web  ",
  location: " Bamako ",
  skills: [" TypeScript ", "Python"],
  hobbies: ["Lecture"],
};

describe("Saisie du profil", () => {
  it("normalise les champs publics sans accepter le nom légal", () => {
    expect(parseProfileUpdate(valid)).toEqual({
      handle: "awa_dev",
      photoUrl: "https://example.org/avatar.png",
      bio: "Développeuse web",
      location: "Bamako",
      skills: ["TypeScript", "Python"],
      hobbies: ["Lecture"],
    });
    expect(() => parseProfileUpdate({ ...valid, legalName: "Autre nom" }))
      .toThrow(/inconnu/);
  });

  it("refuse les photos non HTTPS et les doublons de compétences", () => {
    expect(() => parseProfileUpdate({ ...valid, photoUrl: "http://example.org/a.png" }))
      .toThrow(/HTTPS/);
    expect(() => parseProfileUpdate({ ...valid, photoUrl: "javascript:alert(1)" }))
      .toThrow(/HTTPS/);
    expect(() => parseProfileUpdate({ ...valid, skills: ["Python", "python"] }))
      .toThrow(/double/);
  });

  it("limite la longueur et le nombre de libellés", () => {
    expect(() => parseProfileUpdate({ ...valid, bio: "a".repeat(501) }))
      .toThrow(/long/);
    expect(() => parseProfileUpdate({ ...valid, hobbies: Array(21).fill("Sport") }))
      .toThrow(/invalide/);
    expect(() => parseProfileUpdate({ ...valid, skills: [" "] }))
      .toThrow(/invalide/);
  });
});