import { utcDayString } from "@/lib/reading-time";

/** 与阅读时长统计一致：按 UTC 自然日计数 */
export const VOCABULARY_DAILY_ADD_LIMIT = 20;

export const VOCAB_DAILY_LIMIT_CODE = "VOCAB_DAILY_LIMIT" as const;

export function vocabularyUtcDayBounds(): { dayStart: Date; dayEndExclusive: Date } {
  const day = utcDayString();
  const dayStart = new Date(`${day}T00:00:00.000Z`);
  const dayEndExclusive = new Date(dayStart);
  dayEndExclusive.setUTCDate(dayEndExclusive.getUTCDate() + 1);
  return { dayStart, dayEndExclusive };
}
