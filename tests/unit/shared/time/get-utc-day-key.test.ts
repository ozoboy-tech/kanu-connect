import { describe, expect, it } from "vitest";

import { getUtcDayKey } from "@/shared/domain/time/get-utc-day-key";

describe("Identification de la journée UTC", () => {
  it.each([
    ["2026-10-04T23:59:59.999Z", "2026-10-04"],
    ["2026-10-05T00:00:00.000Z", "2026-10-05"],
    ["2026-10-05T01:30:00+02:00", "2026-10-04"],
    ["2026-10-04T23:30:00-04:00", "2026-10-05"],
    ["2027-01-01T00:30:00+01:00", "2026-12-31"],
  ])(
    "classe l'instant %s dans la journée %s",
    (instant, expectedDay) => {
      const result = getUtcDayKey(new Date(instant));

      expect(result).toBe(expectedDay);
    },
  );

  it("rejette une date invalide", () => {
    const invalidDate = new Date(Number.NaN);

    expect(() => {
      getUtcDayKey(invalidDate);
    }).toThrow(RangeError);
  });
});