export const pageSize = 20;
export const maxPage = 1000;

export function parsePage(value: string | null): number {
  const raw = value ?? "1";
  if (!/^[1-9]\d{0,3}$/u.test(raw) || Number(raw) > maxPage) {
    throw new TypeError("Page invalide.");
  }
  return Number(raw);
}

export function pageWindow(page: number): string {
  if (!Number.isInteger(page) || page < 1 || page > maxPage) {
    throw new TypeError("Page invalide.");
  }
  return `LIMIT ${pageSize + 1} OFFSET ${(page - 1) * pageSize}`;
}

export function pageResult<T>(rows: T[], page: number) {
  return { items: rows.slice(0, pageSize), page,
    hasNext: rows.length > pageSize && page < maxPage };
}