export interface StreakState {
  currentDays: number;
  bestDays: number;
  lastDay: string | null;
}

function dayNumber(day: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new RangeError("Jour UTC invalide.");
  const instant = Date.parse(`${day}T00:00:00.000Z`);
  if (!Number.isFinite(instant) || new Date(instant).toISOString().slice(0, 10) !== day) {
    throw new RangeError("Jour UTC invalide.");
  }
  return instant / 86_400_000;
}

export function advanceStreak(state: StreakState, today: string): StreakState {
  const currentDay = dayNumber(today);
  if (!Number.isSafeInteger(state.currentDays) || state.currentDays < 0 ||
      !Number.isSafeInteger(state.bestDays) || state.bestDays < state.currentDays) {
    throw new RangeError("Série invalide.");
  }
  const distance = state.lastDay === null ? null : currentDay - dayNumber(state.lastDay);
  if (distance !== null && distance < 0) throw new RangeError("Jour antérieur à la série.");
  if (distance === 0) return state;
  const currentDays = distance !== null && distance <= 2
    ? state.currentDays + 1 : 1;
  return { currentDays, bestDays: Math.max(state.bestDays, currentDays), lastDay: today };
}

export function visibleStreak(state: StreakState, today: string): number {
  if (!state.lastDay) return 0;
  return dayNumber(today) - dayNumber(state.lastDay) <= 2 ? state.currentDays : 0;
}
