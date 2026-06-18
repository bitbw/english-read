import { db } from "@/lib/db";
import {
  books,
  publicLibraryBooks,
  readingDailyTime,
  reviewDailyStats,
  users,
} from "@/lib/db/schema";
import {
  computeStudyScore,
  DEFAULT_LEADERBOARD_LIMIT,
  MIN_LEADERBOARD_SECONDS,
  MIN_WPM_SECONDS,
  STREAK_LOOKBACK_DAYS,
  type LeaderboardMetric,
  type LeaderboardPeriod,
} from "@/lib/leaderboard/constants";
import { resolveLeaderboardPeriod, type LeaderboardDayRange } from "@/lib/leaderboard/period";
import { computeCurrentStreak, mergeActiveDaySets } from "@/lib/leaderboard/streak";
import { avgWpmFromTotals } from "@/lib/reading-wpm";
import { calendarDayKey, calendarDayKeys } from "@/lib/user-calendar";
import { and, desc, eq, gte, gt, inArray, isNotNull, lt, lte, sql } from "drizzle-orm";

export type LeaderboardUserRow = {
  userId: string;
  name: string | null;
  image: string | null;
  value: number;
};

export type LeaderboardUserItem = LeaderboardUserRow & { rank: number };

export type LeaderboardMe = {
  optedIn: boolean;
  rank: number | null;
  value: number | null;
  shadowRank?: number | null;
};

export type UserLeaderboardResult = {
  metric: LeaderboardMetric;
  period: LeaderboardPeriod | null;
  start: string | null;
  end: string | null;
  items: LeaderboardUserItem[];
  me: LeaderboardMe;
};

export type PopularBookItem = {
  rank: number;
  publicBookId: string;
  title: string;
  author: string | null;
  coverUrl: string | null;
  tier: string;
  shelfCount: number;
};

export type PopularBooksLeaderboardResult = {
  metric: "popular_books";
  items: PopularBookItem[];
};

type UserAggregate = LeaderboardUserRow & { optedIn: boolean };

function dayFilterForReading(range: LeaderboardDayRange) {
  if (range.start == null || range.end == null) return sql`true`;
  return and(gte(readingDailyTime.day, range.start), lte(readingDailyTime.day, range.end));
}

function dayFilterForReview(range: LeaderboardDayRange) {
  if (range.start == null || range.end == null) return sql`true`;
  return and(gte(reviewDailyStats.day, range.start), lte(reviewDailyStats.day, range.end));
}

function buildUserLeaderboard(
  metric: LeaderboardMetric,
  period: LeaderboardPeriod | null,
  range: LeaderboardDayRange,
  rankedAll: UserAggregate[],
  currentUserId: string,
  limit: number,
): UserLeaderboardResult {
  const displayList = rankedAll.filter((r) => r.optedIn);
  const items = displayList.slice(0, limit).map((row, index) => ({
    rank: index + 1,
    userId: row.userId,
    name: row.name,
    image: row.image,
    value: row.value,
  }));

  const meRow = rankedAll.find((r) => r.userId === currentUserId);
  const optedIn = meRow?.optedIn ?? false;

  let rank: number | null = null;
  let shadowRank: number | null | undefined;

  if (meRow) {
    if (optedIn) {
      const idx = displayList.findIndex((r) => r.userId === currentUserId);
      rank = idx >= 0 ? idx + 1 : null;
    } else {
      let shadow = 1;
      for (const row of displayList) {
        if (row.value > meRow.value) shadow++;
        else if (row.value === meRow.value && row.userId.localeCompare(meRow.userId) < 0) shadow++;
      }
      shadowRank = displayList.length === 0 && meRow.value > 0 ? 1 : shadow;
    }
  }

  return {
    metric,
    period,
    start: range.start,
    end: range.end,
    items,
    me: {
      optedIn,
      rank: optedIn ? rank : null,
      value: meRow?.value ?? null,
      shadowRank: !optedIn ? shadowRank ?? null : undefined,
    },
  };
}

async function fetchUserMeta(userIds: string[]): Promise<
  Map<string, { name: string | null; image: string | null; optedIn: boolean }>
> {
  if (userIds.length === 0) return new Map();
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      image: users.image,
      showOnLeaderboard: users.showOnLeaderboard,
    })
    .from(users)
    .where(inArray(users.id, userIds));

  return new Map(
    rows.map((r) => [
      r.id,
      { name: r.name, image: r.image, optedIn: r.showOnLeaderboard },
    ]),
  );
}

async function getReadingSecondsByUser(range: LeaderboardDayRange): Promise<Map<string, number>> {
  const rows = await db
    .select({
      userId: readingDailyTime.userId,
      total: sql<number>`coalesce(sum(${readingDailyTime.seconds}), 0)::int`.as("total"),
    })
    .from(readingDailyTime)
    .where(dayFilterForReading(range))
    .groupBy(readingDailyTime.userId);

  return new Map(rows.map((r) => [r.userId, r.total]));
}

async function getReviewSecondsByUser(range: LeaderboardDayRange): Promise<Map<string, number>> {
  const rows = await db
    .select({
      userId: reviewDailyStats.userId,
      total: sql<number>`coalesce(sum(${reviewDailyStats.seconds}), 0)::int`.as("total"),
    })
    .from(reviewDailyStats)
    .where(dayFilterForReview(range))
    .groupBy(reviewDailyStats.userId);

  return new Map(rows.map((r) => [r.userId, r.total]));
}

async function getReadingWordsAndSecondsByUser(
  range: LeaderboardDayRange,
): Promise<Map<string, { words: number; seconds: number }>> {
  const rows = await db
    .select({
      userId: readingDailyTime.userId,
      words: sql<number>`coalesce(sum(${readingDailyTime.words}), 0)::int`.as("words"),
      seconds: sql<number>`coalesce(sum(${readingDailyTime.seconds}), 0)::int`.as("seconds"),
    })
    .from(readingDailyTime)
    .where(dayFilterForReading(range))
    .groupBy(readingDailyTime.userId);

  return new Map(rows.map((r) => [r.userId, { words: r.words, seconds: r.seconds }]));
}

async function getCompletedBooksByUser(range: LeaderboardDayRange): Promise<Map<string, number>> {
  const conditions = [gte(books.readingProgress, 100)];
  if (range.rangeStartUtc && range.rangeEndExclusiveUtc) {
    conditions.push(gte(books.updatedAt, range.rangeStartUtc));
    conditions.push(lt(books.updatedAt, range.rangeEndExclusiveUtc));
  }

  const rows = await db
    .select({
      userId: books.userId,
      total: sql<number>`count(*)::int`.as("total"),
    })
    .from(books)
    .where(and(...conditions))
    .groupBy(books.userId);

  return new Map(rows.map((r) => [r.userId, r.total]));
}

function sortByValueDesc(rows: UserAggregate[]): UserAggregate[] {
  return [...rows].sort((a, b) => b.value - a.value || a.userId.localeCompare(b.userId));
}

async function enrichAndSort(
  valueMap: Map<string, number>,
  currentUserId: string,
  minValue: number,
): Promise<UserAggregate[]> {
  const userIds = new Set(valueMap.keys());
  userIds.add(currentUserId);
  const meta = await fetchUserMeta([...userIds]);

  const rows: UserAggregate[] = [];
  for (const userId of userIds) {
    const value = valueMap.get(userId) ?? 0;
    if (value < minValue && userId !== currentUserId) continue;
    const m = meta.get(userId);
    rows.push({
      userId,
      name: m?.name ?? null,
      image: m?.image ?? null,
      value,
      optedIn: m?.optedIn ?? false,
    });
  }
  return sortByValueDesc(rows);
}

export async function getPopularBooksLeaderboard(
  limit = DEFAULT_LEADERBOARD_LIMIT,
): Promise<PopularBooksLeaderboardResult> {
  const rows = await db
    .select({
      publicBookId: books.publicBookId,
      shelfCount: sql<number>`count(*)::int`.as("shelf_count"),
      title: publicLibraryBooks.title,
      author: publicLibraryBooks.author,
      coverUrl: publicLibraryBooks.coverUrl,
      tier: publicLibraryBooks.tier,
      createdAt: publicLibraryBooks.createdAt,
    })
    .from(books)
    .innerJoin(publicLibraryBooks, eq(books.publicBookId, publicLibraryBooks.id))
    .where(isNotNull(books.publicBookId))
    .groupBy(
      books.publicBookId,
      publicLibraryBooks.title,
      publicLibraryBooks.author,
      publicLibraryBooks.coverUrl,
      publicLibraryBooks.tier,
      publicLibraryBooks.createdAt,
    )
    .orderBy(desc(sql`shelf_count`), desc(publicLibraryBooks.createdAt))
    .limit(limit);

  return {
    metric: "popular_books",
    items: rows.map((row, index) => ({
      rank: index + 1,
      publicBookId: row.publicBookId!,
      title: row.title,
      author: row.author,
      coverUrl: row.coverUrl,
      tier: row.tier,
      shelfCount: row.shelfCount,
    })),
  };
}

export async function getReadingTimeLeaderboard(
  period: LeaderboardPeriod,
  timeZone: string,
  currentUserId: string,
  limit = DEFAULT_LEADERBOARD_LIMIT,
): Promise<UserLeaderboardResult> {
  const range = resolveLeaderboardPeriod(period, timeZone);
  const valueMap = await getReadingSecondsByUser(range);
  const rankedAll = await enrichAndSort(valueMap, currentUserId, MIN_LEADERBOARD_SECONDS);
  return buildUserLeaderboard("reading_time", period, range, rankedAll, currentUserId, limit);
}

export async function getReviewTimeLeaderboard(
  period: LeaderboardPeriod,
  timeZone: string,
  currentUserId: string,
  limit = DEFAULT_LEADERBOARD_LIMIT,
): Promise<UserLeaderboardResult> {
  const range = resolveLeaderboardPeriod(period, timeZone);
  const valueMap = await getReviewSecondsByUser(range);
  const rankedAll = await enrichAndSort(valueMap, currentUserId, MIN_LEADERBOARD_SECONDS);
  return buildUserLeaderboard("review_time", period, range, rankedAll, currentUserId, limit);
}

export async function getTotalStudyTimeLeaderboard(
  period: LeaderboardPeriod,
  timeZone: string,
  currentUserId: string,
  limit = DEFAULT_LEADERBOARD_LIMIT,
): Promise<UserLeaderboardResult> {
  const range = resolveLeaderboardPeriod(period, timeZone);
  const [readingMap, reviewMap] = await Promise.all([
    getReadingSecondsByUser(range),
    getReviewSecondsByUser(range),
  ]);
  const userIds = new Set([...readingMap.keys(), ...reviewMap.keys(), currentUserId]);
  const valueMap = new Map<string, number>();
  for (const userId of userIds) {
    valueMap.set(userId, (readingMap.get(userId) ?? 0) + (reviewMap.get(userId) ?? 0));
  }
  const rankedAll = await enrichAndSort(valueMap, currentUserId, MIN_LEADERBOARD_SECONDS);
  return buildUserLeaderboard("total_study_time", period, range, rankedAll, currentUserId, limit);
}

export async function getStudyScoreLeaderboard(
  period: LeaderboardPeriod,
  timeZone: string,
  currentUserId: string,
  limit = DEFAULT_LEADERBOARD_LIMIT,
): Promise<UserLeaderboardResult> {
  const range = resolveLeaderboardPeriod(period, timeZone);
  const [readingMap, reviewMap, completedMap] = await Promise.all([
    getReadingSecondsByUser(range),
    getReviewSecondsByUser(range),
    getCompletedBooksByUser(range),
  ]);
  const userIds = new Set([
    ...readingMap.keys(),
    ...reviewMap.keys(),
    ...completedMap.keys(),
    currentUserId,
  ]);
  const valueMap = new Map<string, number>();
  for (const userId of userIds) {
    const score = computeStudyScore(
      readingMap.get(userId) ?? 0,
      reviewMap.get(userId) ?? 0,
      completedMap.get(userId) ?? 0,
    );
    valueMap.set(userId, score);
  }
  const rankedAll = await enrichAndSort(valueMap, currentUserId, 1);
  return buildUserLeaderboard("study_score", period, range, rankedAll, currentUserId, limit);
}

export async function getReadingWpmLeaderboard(
  period: LeaderboardPeriod,
  timeZone: string,
  currentUserId: string,
  limit = DEFAULT_LEADERBOARD_LIMIT,
): Promise<UserLeaderboardResult> {
  const range = resolveLeaderboardPeriod(period, timeZone);
  const statsMap = await getReadingWordsAndSecondsByUser(range);
  const userIds = new Set([...statsMap.keys(), currentUserId]);
  const valueMap = new Map<string, number>();
  for (const userId of userIds) {
    const stats = statsMap.get(userId);
    const wpm = stats
      ? avgWpmFromTotals(stats.words, stats.seconds, MIN_WPM_SECONDS)
      : null;
    if (wpm != null) valueMap.set(userId, wpm);
    else if (userId === currentUserId) valueMap.set(userId, 0);
  }
  const rankedAll = await enrichAndSort(valueMap, currentUserId, 1);
  const filtered = rankedAll.filter((r) => r.value > 0 || r.userId === currentUserId);
  return buildUserLeaderboard("reading_wpm", period, range, filtered, currentUserId, limit);
}

export async function getBooksCompletedLeaderboard(
  period: LeaderboardPeriod,
  timeZone: string,
  currentUserId: string,
  limit = DEFAULT_LEADERBOARD_LIMIT,
): Promise<UserLeaderboardResult> {
  const range = resolveLeaderboardPeriod(period, timeZone);
  const valueMap = await getCompletedBooksByUser(range);
  if (!valueMap.has(currentUserId)) valueMap.set(currentUserId, 0);
  const rankedAll = await enrichAndSort(valueMap, currentUserId, 1);
  return buildUserLeaderboard("books_completed", period, range, rankedAll, currentUserId, limit);
}

export async function getStudyStreakLeaderboard(
  timeZone: string,
  currentUserId: string,
  limit = DEFAULT_LEADERBOARD_LIMIT,
): Promise<UserLeaderboardResult> {
  const lookbackStart = calendarDayKeys(STREAK_LOOKBACK_DAYS, timeZone)[0]!;
  const todayKey = calendarDayKey(timeZone);
  const range: LeaderboardDayRange = {
    start: lookbackStart,
    end: todayKey,
    rangeStartUtc: null,
    rangeEndExclusiveUtc: null,
  };

  const [readingRows, reviewRows] = await Promise.all([
    db
      .select({ userId: readingDailyTime.userId, day: readingDailyTime.day })
      .from(readingDailyTime)
      .where(
        and(
          gte(readingDailyTime.day, lookbackStart),
          lte(readingDailyTime.day, todayKey),
          gt(readingDailyTime.seconds, 0),
        ),
      ),
    db
      .select({ userId: reviewDailyStats.userId, day: reviewDailyStats.day })
      .from(reviewDailyStats)
      .where(
        and(
          gte(reviewDailyStats.day, lookbackStart),
          lte(reviewDailyStats.day, todayKey),
          gt(reviewDailyStats.seconds, 0),
        ),
      ),
  ]);

  const activeByUser = mergeActiveDaySets([...readingRows, ...reviewRows]);
  const allUserIds = new Set([...activeByUser.keys(), currentUserId]);
  const valueMap = new Map<string, number>();
  for (const userId of allUserIds) {
    const days = activeByUser.get(userId);
    valueMap.set(userId, days ? computeCurrentStreak(days, todayKey, timeZone) : 0);
  }

  const rankedAll = await enrichAndSort(valueMap, currentUserId, 1);
  return buildUserLeaderboard("study_streak", null, range, rankedAll, currentUserId, limit);
}

export async function getLeaderboard(
  metric: LeaderboardMetric,
  period: LeaderboardPeriod,
  timeZone: string,
  currentUserId: string,
  limit = DEFAULT_LEADERBOARD_LIMIT,
): Promise<UserLeaderboardResult | PopularBooksLeaderboardResult> {
  switch (metric) {
    case "popular_books":
      return getPopularBooksLeaderboard(limit);
    case "reading_time":
      return getReadingTimeLeaderboard(period, timeZone, currentUserId, limit);
    case "review_time":
      return getReviewTimeLeaderboard(period, timeZone, currentUserId, limit);
    case "total_study_time":
      return getTotalStudyTimeLeaderboard(period, timeZone, currentUserId, limit);
    case "study_score":
      return getStudyScoreLeaderboard(period, timeZone, currentUserId, limit);
    case "reading_wpm":
      return getReadingWpmLeaderboard(period, timeZone, currentUserId, limit);
    case "books_completed":
      return getBooksCompletedLeaderboard(period, timeZone, currentUserId, limit);
    case "study_streak":
      return getStudyStreakLeaderboard(timeZone, currentUserId, limit);
  }
}

export function isPopularBooksResult(
  result: UserLeaderboardResult | PopularBooksLeaderboardResult,
): result is PopularBooksLeaderboardResult {
  return result.metric === "popular_books";
}
