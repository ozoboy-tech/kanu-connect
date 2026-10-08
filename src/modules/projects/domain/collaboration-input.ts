export type CollaborationStatus = "pending" | "accepted" | "rejected";
export type CollaborationDecision = Exclude<CollaborationStatus, "pending">;

export interface CollaborationRequest {
  memberId: string;
  handle: string;
  message: string;
  status: CollaborationStatus;
}

export interface CollaborationState {
  isOwner: boolean;
  requests: CollaborationRequest[];
  nextCursor: string | null;
}

export function parseCollaborationMessage(value: unknown): string {
  if (typeof value !== "string") throw new TypeError("Message requis.");
  const message = value.trim();
  if (!message || message.length > 1000) {
    throw new TypeError("Le message doit contenir entre 1 et 1000 caractères.");
  }
  return message;
}

export function parseCollaborationDecision(value: unknown): CollaborationDecision {
  if (value !== "accepted" && value !== "rejected") {
    throw new TypeError("Décision invalide.");
  }
  return value;
}

export function parseCollaborationCursor(value: string | null): string | null {
  if (value === null) return null;
  if (!/^[1-9]\d{0,19}$/.test(value) ||
      (value.length === 20 && value > "18446744073709551615")) {
    throw new TypeError("Curseur invalide.");
  }
  return value;
}
