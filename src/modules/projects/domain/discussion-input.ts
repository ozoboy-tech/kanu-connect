export { parseCollaborationCursor as parseDiscussionCursor } from "./collaboration-input";

export interface DiscussionMessage {
  id: string;
  authorId: string;
  authorHandle: string;
  body: string;
  createdAt: string;
}

export interface DiscussionPage {
  messages: DiscussionMessage[];
  nextCursor: string | null;
}

export function parseDiscussionMessage(value: unknown): string {
  if (typeof value !== "string") throw new TypeError("Message requis.");
  const message = value.trim();
  if (!message || message.length > 2000) {
    throw new TypeError("Le message doit contenir entre 1 et 2000 caractères.");
  }
  return message;
}
