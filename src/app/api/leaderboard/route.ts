import { requireSessionApi } from "@/lib/api-session";
import {
  DEFAULT_LEADERBOARD_LIMIT,
  isLeaderboardMetric,
  isLeaderboardPeriod,
  MAX_LEADERBOARD_LIMIT,
  metricSupportsPeriod,
  type LeaderboardMetric,
  type LeaderboardPeriod,
} from "@/lib/leaderboard/constants";
import { getLeaderboard } from "@/lib/leaderboard/queries";
import { resolveTimeZone } from "@/lib/user-timezone";
import { NextResponse } from "next/server";

// GET /api/leaderboard?metric=reading_time&period=week&limit=50
export async function GET(req: Request) {
  const authResult = await requireSessionApi();
  if ("error" in authResult) return authResult.error;

  const { searchParams } = new URL(req.url);
  const metricParam = searchParams.get("metric") ?? "";
  if (!isLeaderboardMetric(metricParam)) {
    return NextResponse.json({ error: "Invalid metric" }, { status: 400 });
  }

  const metric: LeaderboardMetric = metricParam;
  const periodParam = searchParams.get("period") ?? "week";
  if (!isLeaderboardPeriod(periodParam)) {
    return NextResponse.json({ error: "Invalid period" }, { status: 400 });
  }
  const period: LeaderboardPeriod = periodParam;

  if (!metricSupportsPeriod(metric) && period !== "all") {
    // ignored for streak / popular_books
  }

  const rawLimit = parseInt(searchParams.get("limit") ?? String(DEFAULT_LEADERBOARD_LIMIT), 10);
  const limit = Number.isFinite(rawLimit)
    ? Math.min(MAX_LEADERBOARD_LIMIT, Math.max(1, rawLimit))
    : DEFAULT_LEADERBOARD_LIMIT;

  const userId = authResult.session.user.id;
  const timeZone = await resolveTimeZone(userId, req);
  const effectivePeriod = metricSupportsPeriod(metric) ? period : "all";

  const data = await getLeaderboard(metric, effectivePeriod, timeZone, userId, limit);
  return NextResponse.json(data);
}
