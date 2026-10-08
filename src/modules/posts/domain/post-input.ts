import {
  opportunityForPost,
  type OpportunityInput,
} from "@/modules/opportunities/domain/opportunity-input";

export const spaces = ["questions", "sharing", "projects", "opportunities"] as const;

export const kinds = [
  "question", "tip", "project", "opportunity", "tutorial", "announcement",
] as const;
export const languages = [
  "typescript", "javascript", "python", "php", "sql", "bash",
  "html", "css", "java", "csharp", "go", "rust",
] as const;
export type Space = typeof spaces[number];
export type Kind = typeof kinds[number];

export interface PostInput {
  kind: Kind;
  space: Space;
  title: string;
  body: string;
  code: string | null;
  codeLanguage: string | null;
  keywords: string[];
  opportunity?: OpportunityInput | null;
}

export function parsePostInput(value: unknown): PostInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("Publication invalide.");
  }
  const item = value as Record<string, unknown>;
  const allowed = new Set([
    "kind", "space", "title", "body", "code", "codeLanguage", "keywords", "opportunity",
  ]);
  if (Object.keys(item).some((key) => !allowed.has(key)) ||
      !kinds.includes(item.kind as Kind) ||
      !spaces.includes(item.space as Space) ||
      typeof item.title !== "string" || typeof item.body !== "string") {
    throw new TypeError("Champs de publication invalides.");
  }
  const title = item.title.trim().replace(/\s+/gu, " ");
  const body = item.body.trim();
  if (!title || title.length > 160 || !body || body.length > 6000) {
    throw new TypeError("Titre ou texte invalide.");
  }
  const code = item.code === null ? null :
    typeof item.code === "string" ? item.code.trim() || null : undefined;
  const codeLanguage = item.codeLanguage === null ? null :
    typeof item.codeLanguage === "string" ? item.codeLanguage.trim().toLowerCase() : undefined;
  if (code === undefined || codeLanguage === undefined ||
      (code !== null && code.length > 6000) ||
      (code === null ? codeLanguage !== null :
        !codeLanguage || !languages.includes(
          codeLanguage as typeof languages[number],
        ))) {
    throw new TypeError("Bloc de code ou langage invalide.");
  }
  if (!Array.isArray(item.keywords) || item.keywords.length < 1 ||
      item.keywords.length > 5) {
    throw new TypeError("Un à cinq mots-clés sont requis.");
  }
  const keywords: string[] = [];
  const seen = new Set<string>();
  for (const raw of item.keywords) {
    if (typeof raw !== "string") throw new TypeError("Mot-clé invalide.");
    const keyword = raw.trim().toLocaleLowerCase("fr");
    if (!/^[\p{L}\p{N}][\p{L}\p{N}_-]{1,31}$/u.test(keyword) ||
        seen.has(keyword)) throw new TypeError("Mot-clé invalide ou en double.");
    seen.add(keyword);
    keywords.push(keyword);
  }
  return {
    kind: item.kind as Kind, space: item.space as Space,
    title, body, code, codeLanguage, keywords,
    opportunity: opportunityForPost({
      kind: item.kind as Kind,
      space: item.space as Space,
      opportunity: item.opportunity,
    }),

  };
}

export function validPostId(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value);
}