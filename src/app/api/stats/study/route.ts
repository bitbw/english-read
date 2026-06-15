import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { readingDailyTime, reviewDailyStats, reviewLogs } from "@/lib/db/schema";
import { avgWpmFromTotals } from "@/lib/reading-wpm";
import {
  calendarDayKey,
  calendarDayKeys,
  calendarDayKeysBetween,
  isCalendarDayKey,
  zonedDayRangeUtc,
} from "@/lib/user-calendar";
import { resolveTimeZone } from "@/lib/user-timezone";
import { and, eq, gte, lt, lte } from "drizzle-orm";
import { NextResponse } from "next/server";

const MAX_RANGE_DAYS = 90;

function resolveDayRange(
  searchParams: URLSearchParams,
  timeZone: string
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
    if (keys.length > MAX_RANGE_DAYS) {
      return { error: `Range exceeds ${MAX_RANGE_DAYS} days` };
    }
    return { start: startParam, end: endParam };
  }

  const raw = parseInt(searchParams.get("days") ?? "14", 10);
  const numDays = Number.isFinite(raw) ? Math.min(MAX_RANGE_DAYS, Math.max(7, raw)) : 14;
  const keys = calendarDayKeys(numDays, timeZone);
  return { start: keys[0]!, end: keys[keys.length - 1]! };
}

// GET /api/stats/study?days=14 | ?start=YYYY-MM-DD&end=YYYY-MM-DD
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const timeZone = await resolveTimeZone(session.user.id, req);
  const { searchParams } = new URL(req.url);
  const range = resolveDayRange(searchParams, timeZone);
  if ("error" in range) {
    return NextResponse.json({ error: range.error }, { status: 400 });
  }

  const { start, end } = range;
  const dayKeys = calendarDayKeysBetween(start, end, timeZone);
  const { dayStart: rangeStartUtc } = zonedDayRangeUtc(start, timeZone);
  const { dayEndExclusive: rangeEndExclusiveUtc } = zonedDayRangeUtc(end, timeZone);

  const userId = session.user.id;

  const [readingRows, reviewStatRows, reviewLogRows] = await Promise.all([
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
          lte(readingDailyTime.day, end)
        )
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
          lte(reviewDailyStats.day, end)
        )
      ),
    db
      .select({ reviewedAt: reviewLogs.reviewedAt })
      .from(reviewLogs)
      .where(
        and(
          eq(reviewLogs.userId, userId),
          gte(reviewLogs.reviewedAt, rangeStartUtc),
          lt(reviewLogs.reviewedAt, rangeEndExclusiveUtc)
        )
      ),
  ]);

  const readingMap = new Map(
    readingRows.map((r) => [r.day, { seconds: r.seconds, words: r.words }])
  );
  const reviewStatMap = new Map(
    reviewStatRows.map((r) => [r.day, { seconds: r.seconds, errorCount: r.errorCount }])
  );

  const reviewedByDay = new Map<string, number>();
  for (const row of reviewLogRows) {
    const day = calendarDayKey(timeZone, row.reviewedAt);
    if (day < start || day > end) continue;
    reviewedByDay.set(day, (reviewedByDay.get(day) ?? 0) + 1);
  }

  let totalReadingSeconds = 0;
  let totalReadingWords = 0;
  let totalReviewedCount = 0;
  let totalErrorCount = 0;
  let totalReviewSeconds = 0;

  const series = dayKeys.map((day) => {
    const reading = readingMap.get(day);
    const reviewStat = reviewStatMap.get(day);
    const readingSeconds = reading?.seconds ?? 0;
    const readingWords = reading?.words ?? 0;
    const reviewedCount = reviewedByDay.get(day) ?? 0;
    const errorCount = reviewStat?.errorCount ?? 0;
    const reviewSeconds = reviewStat?.seconds ?? 0;

    totalReadingSeconds += readingSeconds;
    totalReadingWords += readingWords;
    totalReviewedCount += reviewedCount;
    totalErrorCount += errorCount;
    totalReviewSeconds += reviewSeconds;

    return {
      day,
      readingSeconds,
      readingWords,
      reviewedCount,
      errorCount,
      reviewSeconds,
      errorRate: reviewedCount > 0 ? Math.round((errorCount / reviewedCount) * 100) : null,
    };
  });

  return NextResponse.json({
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
    },
  });
}
