import { projectStatuses, type ProjectStatus } from "@/modules/projects/domain/project-input";
import { kinds, spaces, type Kind, type Space } from "@/modules/posts/domain/post-input";

export const explorePageSize = 20;
export const exploreMaxPage = 1000;

export interface ExploreQuery {
  kind: "members" | "projects" | "posts";
  q: string;
  skill: string;
  location: string;
  technology: string;
  status: ProjectStatus | "";
  page: number;
  space?: Space | "";
  type?: Kind | "";
  keyword?: string;
  sort?: "recent" | "popular" | "unanswered";
  feed?: "public" | "following" | "foryou";
}

export function parseExploreQuery(params: URLSearchParams): ExploreQuery {
  const allowed = new Set(["kind", "q", "skill", "location", "technology", "status", "page",
    "space", "type", "keyword", "sort", "feed"]);
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
  if (kind !== "members" && kind !== "projects" && kind !== "posts") throw new TypeError("Type invalide.");
  const q = text("q", 120);
  const skill = text("skill", 64);
  const location = text("location", 120);
  const technology = text("technology", 32);
  const status = text("status", 16);
  const space = text("space", 16);
  const type = text("type", 16);
  const keyword = text("keyword", 32);
  const sort = text("sort", 16) || "recent";
  const feed = text("feed", 16) || "public";
  if ((space && !spaces.includes(space as Space)) || (type && !kinds.includes(type as Kind)) ||
      !["recent", "popular", "unanswered"].includes(sort) ||
      !["public", "following", "foryou"].includes(feed)) throw new TypeError("Filtre invalide.");
  if ((kind !== "posts" && (space || type || keyword || feed !== "public")) ||
      (kind === "posts" && (skill || location || technology || status)) ||
      (kind === "members" && sort !== "recent") ||
      (sort === "unanswered" && (kind !== "posts" ||
        (type && type !== "question") || (space && space !== "questions")))) {
    throw new TypeError("Filtre incompatible avec cet onglet.");
  }
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
  const query: ExploreQuery = { kind, q, skill, location, technology,
    status: status as ExploreQuery["status"], page: Number(rawPage) };
  if (kind === "posts") Object.assign(query, { space, type, keyword, sort, feed });
  else if (sort !== "recent") query.sort = sort as ExploreQuery["sort"];
  return query;
}

// %, _ et ! sont des caractères saisis, pas des jokers SQL.
export function literalContains(value: string): string {
  return `%${value.replace(/[!%_]/gu, "!$&")}%`;
}

export function exploreHref(query: ExploreQuery, page = query.page): string {
  const params = new URLSearchParams({ kind: query.kind });
  for (const key of ["q", "skill", "location", "technology", "status",
    "space", "type", "keyword", "sort", "feed"] as const) {
    if (query[key]) params.set(key, query[key]);
  }
  if (page !== 1) params.set("page", String(page));
  return `/explore?${params}`;
}

export function feedHref(query: ExploreQuery, page = query.page): string {
  const params = new URL(exploreHref(query, page), "http://localhost").searchParams;
  params.delete("kind");
  return `/feed?${params}`;
}
