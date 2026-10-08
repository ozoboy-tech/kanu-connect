import { projectStatuses, type ProjectStatus } from "@/modules/projects/domain/project-input";

export const explorePageSize = 20;
export const exploreMaxPage = 1000;

export interface ExploreQuery {
  kind: "members" | "projects";
  q: string;
  skill: string;
  location: string;
  technology: string;
  status: ProjectStatus | "";
  page: number;
}

export function parseExploreQuery(params: URLSearchParams): ExploreQuery {
  const allowed = new Set(["kind", "q", "skill", "location", "technology", "status", "page"]);
  for (const key of params.keys()) {
    if (!allowed.has(key) || params.getAll(key).length !== 1) {
      throw new TypeError("Paramètre inconnu ou répété.");
    }
  }
  function text(key: string, max: number): string {
    const raw = params.get(key) ?? "";
    if (raw.length > max || /[\u0000-\u001f\u007f]/u.test(raw)) {
      throw new TypeError("Filtre invalide ou trop long.");
    }
    return raw.trim().replace(/\s+/gu, " ");
  }
  const kind = params.get("kind") || "members";
  if (kind !== "members" && kind !== "projects") throw new TypeError("Type invalide.");
  const q = text("q", 120);
  const skill = text("skill", 64);
  const location = text("location", 120);
  const technology = text("technology", 32);
  const status = text("status", 16);
  if (status && !projectStatuses.includes(status as ProjectStatus)) {
    throw new TypeError("Statut invalide.");
  }
  if ((kind === "members" && (technology || status)) ||
      (kind === "projects" && (skill || location))) {
    throw new TypeError("Filtre incompatible avec cet onglet.");
  }
  const rawPage = params.get("page") ?? "1";
  if (!/^[1-9]\d{0,3}$/u.test(rawPage) || Number(rawPage) > exploreMaxPage) {
    throw new TypeError("Page invalide.");
  }
  return { kind, q, skill, location, technology,
    status: status as ExploreQuery["status"], page: Number(rawPage) };
}

// %, _ et ! sont des caractères saisis, pas des jokers SQL.
export function literalContains(value: string): string {
  return `%${value.replace(/[!%_]/gu, "!$&")}%`;
}

export function exploreHref(query: ExploreQuery, page = query.page): string {
  const params = new URLSearchParams({ kind: query.kind });
  for (const key of ["q", "skill", "location", "technology", "status"] as const) {
    if (query[key]) params.set(key, query[key]);
  }
  if (page !== 1) params.set("page", String(page));
  return `/explore?${params}`;
}
