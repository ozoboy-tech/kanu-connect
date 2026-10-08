import { parseCollaborationCursor } from "@/modules/projects/domain/collaboration-input";

export type NotificationKind = "request" | "accepted" | "rejected" | "discussion";

export interface ProjectNotification {
  id: string;
  kind: NotificationKind;
  projectId: string;
  projectTitle: string;
  actorHandle: string;
  createdAt: string;
  readAt: string | null;
}

export interface NotificationPage {
  notifications: ProjectNotification[];
  unreadCount: number;
  nextCursor: string | null;
}

export const parseNotificationId = parseCollaborationCursor;
