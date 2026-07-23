import { db } from "@/lib/db";
import { readingDailyTime, reviewDailyStats, reviewLogs, vocabulary } from "@/lib/db/schema";
import { avgWpmFromTotals } from "@/lib/reading-wpm";
import {
  calendarDayKey,
  calendarDayKeys,
  calendarDayKeysBetween,
  isCalendarDayKey,
  zonedDayRangeUtc,
} from "@/lib/user-calendar";
import { and, eq, gte, lt, lte, sql } from "drizzle-orm";

export const MAX_STUDY_RANGE_DAYS = 90;

export type StudySeriesPoint = {
  day: string;
  readingSeconds: number;
  readingWords: number;
  reviewedCount: number;
  errorCount: number;
  reviewSeconds: number;
  errorRate: number | null;
  vocabAdded: number;
};

export type StudyStatsResponse = {
  timeZone: string;
  start: string;
  end: string;
  series: StudySeriesPoint[];
  totals: {
    readingSeconds: number;
    readingWords: number;
    reviewedCount: number;
    errorCount: number;
    reviewSeconds: number;
    avgWpm: number | null;
    totalVocabAdded: number;
    avgDailyAdded: number;
    errorRate: number | null;
    avgDailyReadingMins: number;
    avgDailyReviewMins: number;
  };
};

export function resolveStudyDayRange(
  searchParams: URLSearchParams,
  timeZone: string,
): { start: string; end: string } | { error: string } {
  const startParam = searchParams.get("start");
  const endParam = searchParams.get("end");

  if (startParam && endParam) {
    if (!isCalendarDayKey(startParam) || !isCalendarDayKey(endParam)) {
      return { error: "Invalid date format" };
    }
    if (startParam > endParam) {
      return { error: "start must be before or equal to end" };
    }
    const keys = calendarDayKeysBetween(startParam, endParam, timeZone);
    if (keys.length === 0) {
      return { error: "Invalid date range" };
    }
    if (keys.length > MAX_STUDY_RANGE_DAYS) {
      return { error: `Range exceeds ${MAX_STUDY_RANGE_DAYS} days` };
    }
    return { start: startParam, end: endParam };
  }

  const raw = parseInt(searchParams.get("days") ?? "14", 10);
  const numDays = Number.isFinite(raw)
    ? Math.min(MAX_STUDY_RANGE_DAYS, Math.max(7, raw))
    : 14;
  const keys = calendarDayKeys(numDays, timeZone);
  return { start: keys[0]!, end: keys[keys.length - 1]! };
}

export async function getStudyStats(
  userId: string,
  timeZone: string,
  range: { start: string; end: string },
): Promise<StudyStatsResponse> {
  const { start, end } = range;
  const dayKeys = calendarDayKeysBetween(start, end, timeZone);
  const { dayStart: rangeStartUtc } = zonedDayRangeUtc(start, timeZone);
  const { dayEndExclusive: rangeEndExclusiveUtc } = zonedDayRangeUtc(end, timeZone);

  const [readingRows, reviewStatRows, reviewLogRows, vocabRows] = await Promise.all([
    db
      .select({
        day: readingDailyTime.day,
        seconds: readingDailyTime.seconds,
        words: readingDailyTime.words,
      })
      .from(readingDailyTime)
      .where(
        and(
          eq(readingDailyTime.userId, userId),
          gte(readingDailyTime.day, start),
          lte(readingDailyTime.day, end),
        ),
      ),
    db
      .select({
        day: reviewDailyStats.day,
        seconds: reviewDailyStats.seconds,
        errorCount: reviewDailyStats.errorCount,
      })
      .from(reviewDailyStats)
      .where(
        and(
          eq(reviewDailyStats.userId, userId),
          gte(reviewDailyStats.day, start),
          lte(reviewDailyStats.day, end),
        ),
      ),
    db
      .select({ reviewedAt: reviewLogs.reviewedAt })
      .from(reviewLogs)
      .where(
        and(
          eq(reviewLogs.userId, userId),
          gte(reviewLogs.reviewedAt, rangeStartUtc),
          lt(reviewLogs.reviewedAt, rangeEndExclusiveUtc),
        ),
      ),
    db
      .select({
        day: sql<string>`date(${vocabulary.createdAt})`.as("day"),
        count: sql<number>`count(*)`.as("count"),
      })
      .from(vocabulary)
      .where(
        and(
          eq(vocabulary.userId, userId),
          sql`date(${vocabulary.createdAt}) >= ${start}`,
          sql`date(${vocabulary.createdAt}) <= ${end}`,
        ),
      )
      .groupBy(sql`date(${vocabulary.createdAt})`),
  ]);

  const readingMap = new Map(
    readingRows.map((r) => [r.day, { seconds: r.seconds, words: r.words }]),
  );
  const reviewStatMap = new Map(
    reviewStatRows.map((r) => [r.day, { seconds: r.seconds, errorCount: r.errorCount }]),
  );

  const reviewedByDay = new Map<string, number>();
  for (const row of reviewLogRows) {
    const day = calendarDayKey(timeZone, row.reviewedAt);
    if (day < start || day > end) continue;
    reviewedByDay.set(day, (reviewedByDay.get(day) ?? 0) + 1);
  }

  const vocabAddedByDay = new Map<string, number>();
  for (const row of vocabRows) {
    vocabAddedByDay.set(row.day, Number(row.count));
  }

  let totalReadingSeconds = 0;
  let totalReadingWords = 0;
  let totalReviewedCount = 0;
  let totalErrorCount = 0;
  let totalReviewSeconds = 0;
  let totalVocabAdded = 0;

  const series = dayKeys.map((day) => {
    const reading = readingMap.get(day);
    const reviewStat = reviewStatMap.get(day);
    const readingSeconds = reading?.seconds ?? 0;
    const readingWords = reading?.words ?? 0;
    const reviewedCount = reviewedByDay.get(day) ?? 0;
    const errorCount = reviewStat?.errorCount ?? 0;
    const reviewSeconds = reviewStat?.seconds ?? 0;
    const vocabAdded = vocabAddedByDay.get(day) ?? 0;

    totalReadingSeconds += readingSeconds;
    totalReadingWords += readingWords;
    totalReviewedCount += reviewedCount;
    totalErrorCount += errorCount;
    totalReviewSeconds += reviewSeconds;
    totalVocabAdded += vocabAdded;

    return {
      day,
      readingSeconds,
      readingWords,
      reviewedCount,
      errorCount,
      reviewSeconds,
      errorRate: reviewedCount > 0 ? Math.round((errorCount / reviewedCount) * 100) : null,
      vocabAdded,
    };
  });

  const totalDays = dayKeys.length;

  return {
    timeZone,
    start,
    end,
    series,
    totals: {
      readingSeconds: totalReadingSeconds,
      readingWords: totalReadingWords,
      reviewedCount: totalReviewedCount,
      errorCount: totalErrorCount,
      reviewSeconds: totalReviewSeconds,
      avgWpm: avgWpmFromTotals(totalReadingWords, totalReadingSeconds),
      totalVocabAdded,
      avgDailyAdded: Math.round(totalVocabAdded / totalDays),
      errorRate: totalReviewedCount > 0
        ? +((totalErrorCount / totalReviewedCount) * 100).toFixed(1)
        : null,
      avgDailyReadingMins: +(totalReadingSeconds / 60 / totalDays).toFixed(1),
      avgDailyReviewMins: +(totalReviewSeconds / 60 / totalDays).toFixed(1),
    },
  };
}
