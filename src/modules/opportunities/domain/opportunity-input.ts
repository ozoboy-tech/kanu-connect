export const opportunityCategories = [
  "frontend", "backend", "mobile", "data-ai",
  "devops-cloud", "design", "security", "other",
] as const;

export type OpportunityCategory = typeof opportunityCategories[number];

export const opportunityLabels: Record<OpportunityCategory, string> = {
  frontend: "Front-end",
  backend: "Back-end",
  mobile: "Mobile",
  "data-ai": "Data/IA",
  "devops-cloud": "DevOps/Cloud",
  design: "Design UI/UX",
  security: "Cybersécurité",
  other: "Autre",
};

export interface OpportunityInput {
  category: OpportunityCategory;
  deadline: string;
  applyUrl: string;
}

export interface OpportunityDetails extends OpportunityInput {
  archived: boolean;
}

export function parseOpportunity(
  value: unknown,
  now = Date.now(),
): OpportunityInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("Informations de l’opportunité requises.");
  }

  const item = value as Record<string, unknown>;

  if (
    Object.keys(item).some(
      (key) => !["category", "deadline", "applyUrl"].includes(key),
    ) ||
    !opportunityCategories.includes(item.category as OpportunityCategory) ||
    typeof item.deadline !== "string" ||
    typeof item.applyUrl !== "string"
  ) {
    throw new TypeError("Informations de l’opportunité invalides.");
  }

  const date = new Date(item.deadline);

  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(item.deadline) ||
    !Number.isFinite(date.getTime()) ||
    date.toISOString() !== item.deadline ||
    date.getTime() <= now
  ) {
    throw new TypeError("La date limite doit être une date UTC future.");
  }

  let url: URL;
  try {
    url = new URL(item.applyUrl.trim());
  } catch {
    throw new TypeError("Lien de candidature invalide.");
  }

  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.href.length > 500
  ) {
    throw new TypeError("Lien de candidature HTTP ou HTTPS requis.");
  }

  return {
    category: item.category as OpportunityCategory,
    deadline: date.toISOString(),
    applyUrl: url.href,
  };
}

export function opportunityForPost(
  input: { kind: string; space: string; opportunity?: unknown },
  now = Date.now(),
): OpportunityInput | null {
  if (input.kind === "opportunity") {
    if (input.space !== "opportunities") {
      throw new TypeError(
        "Une opportunité appartient à l’espace Opportunités.",
      );
    }

    return parseOpportunity(input.opportunity, now);
  }

  if (input.space === "opportunities" || input.opportunity != null) {
    throw new TypeError("Informations réservées aux opportunités.");
  }

  return null;
}

export function parseOpportunityCategories(
  value: unknown,
): OpportunityCategory[] {
  if (
    !Array.isArray(value) ||
    value.length > opportunityCategories.length ||
    value.some((category) => !opportunityCategories.includes(category)) ||
    new Set(value).size !== value.length
  ) {
    throw new TypeError("Catégories suivies invalides.");
  }

  return opportunityCategories.filter((category) => value.includes(category));
}
