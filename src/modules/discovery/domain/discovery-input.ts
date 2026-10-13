export interface DiscoveryPreferences {
  topics: string[];
  welcomeCompleted: boolean;
  tourCompleted: boolean;
  remindersEnabled: boolean;
}

export function parseDiscoveryPreferences(value: unknown): DiscoveryPreferences {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("Préférences invalides.");
  }
  const input = value as Record<string, unknown>;
  const keys = ["topics", "welcomeCompleted", "tourCompleted", "remindersEnabled"];
  if (Object.keys(input).some((key) => !keys.includes(key)) ||
      !Array.isArray(input.topics) || input.topics.length > 20 ||
      keys.slice(1).some((key) => typeof input[key] !== "boolean")) {
    throw new TypeError("Préférences invalides.");
  }
  const topics: string[] = [];
  for (const raw of input.topics) {
    if (typeof raw !== "string") throw new TypeError("Catégorie invalide.");
    const topic = raw.trim().toLocaleLowerCase("fr");
    if (!/^[\p{L}\p{N}][\p{L}\p{N}_-]{1,31}$/u.test(topic) || topics.includes(topic)) {
      throw new TypeError("Catégorie invalide ou répétée.");
    }
    topics.push(topic);
  }
  return { topics, welcomeCompleted: input.welcomeCompleted as boolean,
    tourCompleted: input.tourCompleted as boolean,
    remindersEnabled: input.remindersEnabled as boolean };
}