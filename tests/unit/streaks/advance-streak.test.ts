import { expect, it } from "vitest";
import { advanceStreak, visibleStreak } from
  "@/modules/streaks/domain/advance-streak";

it("démarre à un jour et n'ajoute jamais deux jours dans la même journée", () => {
  const first = advanceStreak({ currentDays: 0, bestDays: 0, lastDay: null }, "2026-10-04");
  expect(first).toEqual({ currentDays: 1, bestDays: 1, lastDay: "2026-10-04" });
  expect(advanceStreak(first, "2026-10-04")).toEqual(first);
});

it("active le badge à trois journées utiles et préserve le record", () => {
  const second = advanceStreak(
    { currentDays: 1, bestDays: 1, lastDay: "2026-10-04" }, "2026-10-05",
  );
  expect(advanceStreak(second, "2026-10-06")).toEqual({
    currentDays: 3, bestDays: 3, lastDay: "2026-10-06",
  });
});

it("tolère une journée manquée et réinitialise après deux journées manquées", () => {
  const state = { currentDays: 3, bestDays: 3, lastDay: "2026-10-04" };
  expect(visibleStreak(state, "2026-10-06")).toBe(3);
  expect(advanceStreak(state, "2026-10-06").currentDays).toBe(4);
  expect(visibleStreak(state, "2026-10-07")).toBe(0);
  expect(advanceStreak(state, "2026-10-07")).toEqual({
    currentDays: 1, bestDays: 3, lastDay: "2026-10-07",
  });
});

it("franchit correctement les mois et années en UTC", () => {
  expect(advanceStreak(
    { currentDays: 2, bestDays: 2, lastDay: "2026-12-31" }, "2027-01-02",
  ).currentDays).toBe(3);
});

it("refuse des dates invalides ou dans le passé", () => {
  const state = { currentDays: 1, bestDays: 1, lastDay: "2026-10-04" };
  expect(() => advanceStreak(state, "2026-02-30")).toThrow(RangeError);
  expect(() => advanceStreak(state, "2026-10-03")).toThrow(RangeError);
});

