export const reportKinds = ["post", "comment", "project"] as const;
export type ReportKind = typeof reportKinds[number];

export const reportReasons = [
  "spam",
  "harassment",
  "inappropriate",
] as const;
export type ReportReason = typeof reportReasons[number];

const keys = {
  post: "post_id",
  comment: "comment_id",
  project: "project_id",
} as const;

// kind et alias doivent provenir du code, jamais d'une saisie utilisateur.
export function hiddenSql(kind: ReportKind, alias: string): string {
  return `COALESCE(
    (SELECT decisions.decision = 'hide'
     FROM content_moderation_decisions decisions
     WHERE decisions.${keys[kind]} = ${alias}.id),
    (SELECT COUNT(*) FROM content_reports reports
     WHERE reports.${keys[kind]} = ${alias}.id) >= 3
  )`;
}
