export function getUtcDayKey(instant: Date): string {
  if (Number.isNaN(instant.getTime())) {
    throw new RangeError(
      "Impossible de determiner la journee UTC : date invalide.",
    );
  }

  const isoDate = instant.toISOString();

  return isoDate.substring(0, isoDate.indexOf("T"));
}