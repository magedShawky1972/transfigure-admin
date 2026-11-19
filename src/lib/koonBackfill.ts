export const KOON_BACKFILL_PAGE_SIZE = 5;

export function dateToInt(date: Date): number {
  return Number(`${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`);
}

export function intToDateIntString(value: number): string {
  const text = String(value);
  return `${text.slice(6, 8)}/${text.slice(4, 6)}/${text.slice(0, 4)}`;
}

export function isValidKoonBackfillRange(from?: Date, to?: Date): boolean {
  if (!from || !to || Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return false;
  return dateToInt(from) <= dateToInt(to);
}
