export const projectStatuses = ["idea", "building", "paused", "live"] as const;
export type ProjectStatus = typeof projectStatuses[number];
export const projectLabels: Record<ProjectStatus, string> = {
  idea: "Préparation", building: "En cours", paused: "En pause", live: "Terminé",
};
export interface ProjectRole { label: string; filled: boolean }

export interface ProjectInput {
  title: string;
  summary: string;
  description: string;
  status: ProjectStatus;
  technologies: string[];
  repositoryUrl: string | null;
  demoUrl: string | null;
  roles?: ProjectRole[];
}

export function parseProjectRoles(value: unknown): ProjectRole[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 8) throw new TypeError("Rôles invalides.");
  const seen = new Set<string>();
  return value.map((item: unknown) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new TypeError("Rôle invalide.");
    const role = item as Record<string, unknown>;
    if (Object.keys(role).some((key) => key !== "label" && key !== "filled") ||
        typeof role.label !== "string" || typeof role.filled !== "boolean") {
      throw new TypeError("Rôle invalide.");
    }
    const label = role.label.trim().replace(/\s+/gu, " ");
    const key = label.toLocaleLowerCase("fr");
    if (!label || label.length > 64 || /[\u0000-\u001f\u007f]/u.test(label) || seen.has(key)) {
      throw new TypeError("Rôle invalide ou dupliqué.");
    }
    seen.add(key);
    return { label, filled: role.filled };
  });
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
    "repositoryUrl", "demoUrl", "roles",
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
  const demoUrl = httpsUrl(input.demoUrl);
  if (input.status === "live" && !demoUrl) {
    throw new TypeError("Une démonstration HTTPS est requise pour un projet terminé.");
  }
  return {
        title, summary, description, status: input.status as ProjectStatus,
    technologies,
    repositoryUrl: httpsUrl(input.repositoryUrl),
    demoUrl,
    ...(input.roles === undefined ? {} : { roles: parseProjectRoles(input.roles) }),
  };
}
