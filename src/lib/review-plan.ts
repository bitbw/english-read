import { utcDayString } from "@/lib/reading-time";

export { utcDayString as reviewPlanDayKey };

export function isValidPlanDayKey(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

/** UTC 日 key 的当天结束（含） */
export function endOfUtcDay(key: string): Date {
  return new Date(`${key}T23:59:59.999Z`);
}

export function monthUtcDayKeys(year: number, month1to12: number): string[] {
  const last = new Date(Date.UTC(year, month1to12, 0)).getUTCDate();
  const keys: string[] = [];
  for (let d = 1; d <= last; d++) {
    const dt = new Date(Date.UTC(year, month1to12 - 1, d));
    keys.push(dt.toISOString().slice(0, 10));
  }
  return keys;
}

export function padMonthGrid(dayKeys: string[]): (string | null)[] {
  if (dayKeys.length === 0) return [];
  const first = dayKeys[0]!;
  const y = Number(first.slice(0, 4));
  const m = Number(first.slice(5, 7)) - 1;
  const firstD = new Date(Date.UTC(y, m, 1));
  const weekday = firstD.getUTCDay(); // 0 Sun
  const pad = weekday === 0 ? 6 : weekday - 1; // Mon-first grid
  const cells: (string | null)[] = [...Array(pad).fill(null), ...dayKeys];
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}
