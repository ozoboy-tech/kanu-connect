import { describe, expect, it } from "vitest";

import { calculateAwardedPoints } from
  "@/modules/reputation/domain/calculate-awarded-points";

describe("Attribution des points dans la limite quotidienne", () => {
  it.each([
    // Points demandés, déjà attribués aujourd'hui, résultat attendu.
    [5, 0, 5],
    [2, 10, 2],
    [5, 45, 5],
    [5, 48, 2],
    [10, 49, 1],
    [5, 50, 0],
  ])(
    "%i points demandés avec %i déjà attribués : accorde %i",
    (requestedPoints, awardedToday, expectedPoints) => {
      const result = calculateAwardedPoints(
        requestedPoints,
        awardedToday,
      );

      expect(result).toBe(expectedPoints);
    },
  );
});


describe("Validation des montants de points", () => {
    const invalidValues = [
      -1,
      0.5,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
      Number.MAX_SAFE_INTEGER + 1,
    ];
  
    it.each(invalidValues)(
      "rejette une récompense invalide : %s",
      (invalidPoints) => {
        expect(() => {
          calculateAwardedPoints(invalidPoints, 0);
        }).toThrow(RangeError);
      },
    );
  
    it.each(invalidValues)(
      "rejette un cumul quotidien invalide : %s",
      (invalidTotal) => {
        expect(() => {
          calculateAwardedPoints(5, invalidTotal);
        }).toThrow(RangeError);
      },
    );
  });