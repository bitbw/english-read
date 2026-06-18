export const MIN_LEADERBOARD_SECONDS = 60;
export const MIN_WPM_SECONDS = 300;
export const STUDY_SCORE_READING_WEIGHT = 1;
export const STUDY_SCORE_REVIEW_WEIGHT = 1.2;
export const STUDY_SCORE_COMPLETED_BOOK_POINTS = 50;
export const DEFAULT_LEADERBOARD_LIMIT = 50;
export const MAX_LEADERBOARD_LIMIT = 100;
export const STREAK_LOOKBACK_DAYS = 400;

export const LEADERBOARD_METRICS = [
  "popular_books",
  "reading_time",
  "review_time",
  "total_study_time",
  "study_score",
  "reading_wpm",
  "books_completed",
  "study_streak",
] as const;

export type LeaderboardMetric = (typeof LEADERBOARD_METRICS)[number];

export const LEADERBOARD_PERIODS = ["week", "month", "all"] as const;

export type LeaderboardPeriod = (typeof LEADERBOARD_PERIODS)[number];

export function metricSupportsPeriod(metric: LeaderboardMetric): boolean {
  return metric !== "popular_books" && metric !== "study_streak";
}

export function isLeaderboardMetric(value: string): value is LeaderboardMetric {
  return (LEADERBOARD_METRICS as readonly string[]).includes(value);
}

export function isLeaderboardPeriod(value: string): value is LeaderboardPeriod {
  return (LEADERBOARD_PERIODS as readonly string[]).includes(value);
}

export function computeStudyScore(
  readingSeconds: number,
  reviewSeconds: number,
  completedBooks: number,
): number {
  return (
    Math.floor(readingSeconds / 60) * STUDY_SCORE_READING_WEIGHT +
    Math.floor(reviewSeconds / 60) * STUDY_SCORE_REVIEW_WEIGHT +
    completedBooks * STUDY_SCORE_COMPLETED_BOOK_POINTS
  );
}
