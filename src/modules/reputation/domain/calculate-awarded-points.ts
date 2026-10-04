const DAILY_POINTS_LIMIT = 50;

export function calculateAwardedPoints(
  requestedPoints: number,
  awardedToday: number,
): number {
  if (!Number.isSafeInteger(requestedPoints) || requestedPoints < 0) {
    throw new RangeError(
      "Les points demandés doivent être un entier positif ou nul représentable exactement.",
    );
  }

  if (!Number.isSafeInteger(awardedToday) || awardedToday < 0) {
    throw new RangeError(
      "Le cumul quotidien doit être un entier positif ou nul représentable exactement.",
    );
  }

  const remainingPoints = Math.max(
    0,
    DAILY_POINTS_LIMIT - awardedToday,
  );

  return Math.min(requestedPoints, remainingPoints);
}