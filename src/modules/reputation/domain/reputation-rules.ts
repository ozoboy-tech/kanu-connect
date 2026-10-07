export const ACTION_POINTS = {
  post: 5,
  comment: 2,
  project: 8,
  follow: 1,
  streak: 5,
  votePost: 1,
  voteComment: 1,
  voteProject: 1,
} as const;

export type ReputationAction = keyof typeof ACTION_POINTS;

export function badgesForPoints(points: number): string[] {
  return [
    ...(points >= 10 ? ["Premiers pas"] : []),
    ...(points >= 50 ? ["Contributeur"] : []),
    ...(points >= 200 ? ["Pilier de Kanu"] : []),
  ];
}
