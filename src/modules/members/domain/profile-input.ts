import { normalizeHandle } from "./choose-handle";

export interface ProfileUpdate {
  handle: string;
  photoUrl: string | null;
  bio: string | null;
  location: string | null;
  skills: string[];
  hobbies: string[];
}

function optionalText(value: unknown, max: number): string | null {
  if (value === null) return null;
  if (typeof value !== "string") throw new TypeError("Champ de profil invalide.");
  const trimmed = value.trim().replace(/\s+/gu, " ");
  if (trimmed.length > max) throw new TypeError("Champ de profil trop long.");
  return trimmed || null;
}

function labels(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > 20) {
    throw new TypeError("Liste de profil invalide.");
  }
  const output: string[] = [];
  const seen = new Set<string>();
  for (const entry of value) {
    if (typeof entry !== "string") throw new TypeError("Libellé invalide.");
    const label = entry.trim().replace(/\s+/gu, " ");
    if (!label || label.length > 64) throw new TypeError("Libellé invalide.");
    const key = label.toLocaleLowerCase("fr");
    if (seen.has(key)) throw new TypeError("Libellé en double.");
    seen.add(key);
    output.push(label);
  }
  return output;
}

export function parseProfileUpdate(value: unknown): ProfileUpdate {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("Profil invalide.");
  }
  const input = value as Record<string, unknown>;
  const allowed = new Set([
    "handle", "photoUrl", "bio", "location", "skills", "hobbies",
  ]);
  if (Object.keys(input).some((key) => !allowed.has(key))) {
    throw new TypeError("Champ de profil inconnu.");
  }
  if (typeof input.handle !== "string") throw new TypeError("Pseudo requis.");
  const photoUrl = optionalText(input.photoUrl, 2048);
  if (photoUrl) {
    let parsed: URL;
    try { parsed = new URL(photoUrl); }
    catch { throw new TypeError("URL de photo invalide."); }
    if (parsed.protocol !== "https:" || !parsed.hostname ||
        parsed.username || parsed.password) {
      throw new TypeError("Photo HTTPS requise.");
    }
  }
  return {
    handle: normalizeHandle(input.handle),
    photoUrl,
    bio: optionalText(input.bio, 500),
    location: optionalText(input.location, 120),
    skills: labels(input.skills),
    hobbies: labels(input.hobbies),
  };
}