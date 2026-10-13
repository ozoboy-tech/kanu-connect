import { parseCollaborationCursor } from "@/modules/projects/domain/collaboration-input";

export type ProjectNotificationKind = "request" | "accepted" | "rejected" | "discussion";
export type CommunityNotificationKind = "publication" | "reply" | "mention" | "solution";
export type NotificationKind = ProjectNotificationKind | CommunityNotificationKind;
export type NotificationFilter = "all" | "unread" | "projects" | "community" | "opportunities" | "solutions";

export interface NotificationPreferences {
  projectsEnabled: boolean;
  communityEnabled: boolean;
  opportunitiesEnabled: boolean;
  solutionsEnabled: boolean;
}

export const defaultNotificationPreferences: NotificationPreferences = {
  projectsEnabled: true, communityEnabled: true,
  opportunitiesEnabled: true, solutionsEnabled: true,
};

export function parseNotificationPreferences(value: unknown): NotificationPreferences {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("Préférences invalides.");
  }
  const input = value as Record<string, unknown>;
  const keys = Object.keys(defaultNotificationPreferences);
  if (Object.keys(input).length !== keys.length ||
      Object.keys(input).some((key) => !keys.includes(key)) ||
      keys.some((key) => typeof input[key] !== "boolean")) {
    throw new TypeError("Préférences invalides.");
  }
  return input as unknown as NotificationPreferences;
}

export function parseNotificationFilter(value: string | null): NotificationFilter {
  if (value === null || value === "") return "all";
  if (["all", "unread", "projects", "community", "opportunities", "solutions"].includes(value)) {
    return value as NotificationFilter;
  }
  throw new TypeError("Filtre invalide.");
}


export interface ProjectNotification {
  id: string;
  kind: ProjectNotificationKind;
  projectId: string;
  projectTitle: string;
  actorHandle: string;
  createdAt: string;
  readAt: string | null;
}

export interface NotificationPage {
  notifications: Notification[];
  unreadCount: number;
  nextCursor: string | null;
}

export const parseNotificationId = parseCollaborationCursor;

export interface CommunityNotification {
  id: string;
  kind: CommunityNotificationKind;
  postId: string;
  postTitle: string;
  actorHandle: string;
  createdAt: string;
  readAt: string | null;
}

export type Notification = ProjectNotification | CommunityNotification;

export function extractMentionedHandles(text: string): string[] {
  const handles = new Set<string>();
  const pattern = /(?:^|[^\p{L}\p{N}_@])@([a-zA-Z0-9_]{3,30})(?![\p{L}\p{N}_])/gu;

  for (const match of text.matchAll(pattern)) {
    handles.add(match[1].toLowerCase());
    if (handles.size === 20) break;
  }

  return [...handles];
}