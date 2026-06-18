import { addDays, startOfDay } from "date-fns";
import { TZDate, tz } from "@date-fns/tz";
import { calendarDayKey } from "@/lib/user-calendar";

/** 给定日历日的前一日（同一 IANA 时区语义） */
export function calendarDayBefore(dayKey: string, timeZone: string): string {
  const [y, mo, d] = dayKey.split("-").map(Number);
  const dayStart = startOfDay(new TZDate(y!, mo! - 1, d!, timeZone));
  const prev = addDays(dayStart, -1, { in: tz(timeZone) });
  return calendarDayKey(timeZone, prev);
}

/**
 * 当前连续学习天数：必须从 todayKey 当天有活动起算；今天无活动则 streak = 0。
 */
export function computeCurrentStreak(activeDays: Set<string>, todayKey: string, timeZone: string): number {
  if (!activeDays.has(todayKey)) return 0;

  let streak = 0;
  let cursor = todayKey;
  while (activeDays.has(cursor)) {
    streak++;
    cursor = calendarDayBefore(cursor, timeZone);
  }
  return streak;
}

/** 合并多组 userId -> day 为 userId -> Set<day> */
export function mergeActiveDaySets(
  rows: { userId: string; day: string }[],
): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const row of rows) {
    let set = map.get(row.userId);
    if (!set) {
      set = new Set<string>();
      map.set(row.userId, set);
    }
    set.add(row.day);
  }
  return map;
}
