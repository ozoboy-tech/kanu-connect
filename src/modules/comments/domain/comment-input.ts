import { validPostId } from "@/modules/posts/domain/post-input";

export interface CommentInput {
  body: string;
  parentId: string | null;
}

export function parseCommentInput(value: unknown): CommentInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("Commentaire invalide.");
  }
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some((key) => key !== "body" && key !== "parentId") ||
      typeof input.body !== "string") {
    throw new TypeError("Champs du commentaire invalides.");
  }
  const body = input.body.trim();
  if (!body || body.length > 2000) throw new TypeError("Texte invalide.");
  if (input.parentId !== null &&
      (typeof input.parentId !== "string" || !validPostId(input.parentId))) {
    throw new TypeError("Réponse invalide.");
  }
  return { body, parentId: input.parentId };
}

export function parseCommentEdit(value: unknown): string {
  if (!value || typeof value !== "object" || Array.isArray(value) ||
      Object.keys(value).some((key) => key !== "body") ||
      typeof (value as { body?: unknown }).body !== "string") {
    throw new TypeError("Commentaire invalide.");
  }
  const body = (value as { body: string }).body.trim();
  if (!body || body.length > 2000) throw new TypeError("Texte invalide.");
  return body;
}
