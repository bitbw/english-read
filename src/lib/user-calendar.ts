import { addDays, startOfDay } from "date-fns";
import { TZDate, tz } from "@date-fns/tz";

/** 在指定 IANA 时区下，将某一时刻格式化为日历日 YYYY-MM-DD */
export function calendarDayKey(timeZone: string, instant: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

/** 从「该时区下的今天」往前共 numDays 天（含今天），按时间正序 */
export function calendarDayKeys(numDays: number, timeZone: string): string[] {
  const todayStart = startOfDay(new TZDate(Date.now(), timeZone));
  const keys: string[] = [];
  for (let i = numDays - 1; i >= 0; i--) {
    const d = addDays(todayStart, -i, { in: tz(timeZone) });
    keys.push(calendarDayKey(timeZone, d));
  }
  return keys;
}

/** 日历日 `dayKey`（YYYY-MM-DD）在该时区下的 [dayStart, dayEndExclusive) UTC 半开区间 */
export function zonedDayRangeUtc(
  dayKey: string,
  timeZone: string
): { dayStart: Date; dayEndExclusive: Date } {
  const [y, mo, d] = dayKey.split("-").map(Number);
  if (!y || !mo || !d) {
    throw new Error(`Invalid dayKey: ${dayKey}`);
  }
  const dayStart = startOfDay(new TZDate(y, mo - 1, d, timeZone));
  const dayEndExclusive = addDays(dayStart, 1, { in: tz(timeZone) });
  return {
    dayStart: new Date(dayStart.getTime()),
    dayEndExclusive: new Date(dayEndExclusive.getTime()),
  };
}

/** 给定日历日的下一天（仍在同一套时区语义下） */
export function calendarDayAfter(dayKey: string, timeZone: string): string {
  const [y, mo, d] = dayKey.split("-").map(Number);
  const start = startOfDay(new TZDate(y, mo - 1, d, timeZone));
  const next = addDays(start, 1, { in: tz(timeZone) });
  return calendarDayKey(timeZone, next);
}

const DAY_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** 校验 YYYY-MM-DD 格式 */
export function isCalendarDayKey(value: string): boolean {
  return DAY_KEY_RE.test(value);
}

/** 从 start 到 end（均含）按时间正序生成日历日键；start/end 须为 YYYY-MM-DD */
export function calendarDayKeysBetween(start: string, end: string, timeZone: string): string[] {
  if (!isCalendarDayKey(start) || !isCalendarDayKey(end) || start > end) {
    return [];
  }
  const keys: string[] = [];
  let cursor = start;
  while (cursor <= end) {
    keys.push(cursor);
    if (cursor === end) break;
    cursor = calendarDayAfter(cursor, timeZone);
  }
  return keys;
}
