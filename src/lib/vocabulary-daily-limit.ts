import { calendarDayKey, zonedDayRangeUtc } from "@/lib/user-calendar";

/** 与阅读时长统计一致：按「学习时区」自然日计数 */
export const VOCABULARY_DAILY_ADD_LIMIT = 20;

export const VOCAB_DAILY_LIMIT_CODE = "VOCAB_DAILY_LIMIT" as const;

export function vocabularyZonedDayBounds(timeZone: string): { dayStart: Date; dayEndExclusive: Date } {
  const day = calendarDayKey(timeZone);
  return zonedDayRangeUtc(day, timeZone);
}
