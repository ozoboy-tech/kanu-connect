import { validPostId } from "@/modules/posts/domain/post-input";

export type BookmarkKind = "post" | "project";
export function validBookmark(kind: string, id: string): kind is BookmarkKind {
  return (kind === "post" || kind === "project") && validPostId(id);
}