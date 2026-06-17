import { calendarDayKey, calendarDayKeys, zonedDayRangeUtc } from "@/lib/user-calendar";
import type { LeaderboardPeriod } from "@/lib/leaderboard/constants";

export type LeaderboardDayRange = {
  start: string | null;
  end: string | null;
  rangeStartUtc: Date | null;
  rangeEndExclusiveUtc: Date | null;
};

export function resolveLeaderboardPeriod(
  period: LeaderboardPeriod,
  timeZone: string,
): LeaderboardDayRange {
  if (period === "all") {
    return {
      start: null,
      end: null,
      rangeStartUtc: null,
      rangeEndExclusiveUtc: null,
    };
  }

  const end = calendarDayKey(timeZone);
  let start: string;

  if (period === "week") {
    const keys = calendarDayKeys(7, timeZone);
    start = keys[0]!;
  } else {
    const [y, mo] = end.split("-").map(Number);
    start = `${y}-${String(mo).padStart(2, "0")}-01`;
  }

  const { dayStart: rangeStartUtc } = zonedDayRangeUtc(start, timeZone);
  const { dayEndExclusive: rangeEndExclusiveUtc } = zonedDayRangeUtc(end, timeZone);

  return {
    start,
    end,
    rangeStartUtc,
    rangeEndExclusiveUtc,
  };
}
