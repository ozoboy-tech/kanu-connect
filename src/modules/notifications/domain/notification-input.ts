import { parseCollaborationCursor } from "@/modules/projects/domain/collaboration-input";

export type ProjectNotificationKind = "request" | "accepted" | "rejected" | "discussion";
export type CommunityNotificationKind = "publication" | "reply" | "mention";
export type NotificationKind = ProjectNotificationKind | CommunityNotificationKind;


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