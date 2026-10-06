export const projectStatuses = ["idea", "building", "live"] as const;
export type ProjectStatus = typeof projectStatuses[number];

export interface ProjectInput {
  title: string;
  summary: string;
  description: string;
  status: ProjectStatus;
  technologies: string[];
  repositoryUrl: string | null;
  demoUrl: string | null;
}

function httpsUrl(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== "string" || value.length > 500) {
    throw new TypeError("Lien invalide.");
  }
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:" || !url.hostname || url.username || url.password ||
        url.href.length > 500) throw new TypeError("Lien invalide.");
    return url.href;
  } catch { throw new TypeError("Lien HTTPS invalide."); }
}

export function parseProjectInput(value: unknown): ProjectInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("Projet invalide.");
  }
  const input = value as Record<string, unknown>;
  const allowed = new Set([
    "title", "summary", "description", "status", "technologies",
    "repositoryUrl", "demoUrl",
  ]);
  if (Object.keys(input).some((key) => !allowed.has(key)) ||
      typeof input.title !== "string" || typeof input.summary !== "string" ||
      typeof input.description !== "string" ||
      !projectStatuses.includes(input.status as ProjectStatus) ||
      !Array.isArray(input.technologies) ||
      input.technologies.length < 1 || input.technologies.length > 8) {
    throw new TypeError("Champs du projet invalides.");
  }
  const title = input.title.trim().replace(/\s+/gu, " ");
  const summary = input.summary.trim().replace(/\s+/gu, " ");
  const description = input.description.trim();
  if (!title || title.length > 160 || !summary || summary.length > 300 ||
      !description || description.length > 6000) {
    throw new TypeError("Présentation du projet invalide.");
  }
  const technologies: string[] = [];
  const seen = new Set<string>();
  for (const raw of input.technologies) {
    if (typeof raw !== "string") throw new TypeError("Technologie invalide.");
    const tech = raw.trim().replace(/\s+/gu, " ");
    const key = tech.toLocaleLowerCase("fr");
    if (!tech || tech.length > 32 || seen.has(key)) {
      throw new TypeError("Technologie invalide ou en double.");
    }
    seen.add(key);
    technologies.push(tech);
  }
  return {
    title, summary, description, status: input.status as ProjectStatus,
    technologies,
    repositoryUrl: httpsUrl(input.repositoryUrl),
    demoUrl: httpsUrl(input.demoUrl),
  };
}
