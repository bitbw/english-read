import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { vocabulary } from "@/lib/db/schema";
import { monthUtcDayKeys } from "@/lib/review-plan";
import { calendarDayAfter, calendarDayKey, zonedDayRangeUtc } from "@/lib/user-calendar";
import { resolveTimeZone } from "@/lib/user-timezone";
import { eq, and, lte, gte, lt, count } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

const querySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
});

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const parsed = querySchema.safeParse({
    year: url.searchParams.get("year"),
    month: url.searchParams.get("month"),
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid year/month" }, { status: 400 });
  }

  const { year, month } = parsed.data;
  const userId = session.user.id;
  const now = new Date();
  const timeZone = await resolveTimeZone(userId, req);
  const todayKey = calendarDayKey(timeZone, now);
  const dayKeys = monthUtcDayKeys(year, month);
  const firstKey = dayKeys[0]!;
  const lastKey = dayKeys[dayKeys.length - 1]!;
  const monthStart = zonedDayRangeUtc(firstKey, timeZone).dayStart;
  const afterLast = calendarDayAfter(lastKey, timeZone);
  const monthEndExclusive = zonedDayRangeUtc(afterLast, timeZone).dayStart;

  const [[dueNowRow], monthRows] = await Promise.all([
    db
      .select({ count: count() })
      .from(vocabulary)
      .where(
        and(
          eq(vocabulary.userId, userId),
          eq(vocabulary.isMastered, false),
          lte(vocabulary.nextReviewAt, now)
        )
      ),
    db
      .select({ nextReviewAt: vocabulary.nextReviewAt })
      .from(vocabulary)
      .where(
        and(
          eq(vocabulary.userId, userId),
          eq(vocabulary.isMastered, false),
          gte(vocabulary.nextReviewAt, monthStart),
          lt(vocabulary.nextReviewAt, monthEndExclusive)
        )
      ),
  ]);

  const days: Record<string, { scheduled: number; dueNow: number }> = {};
  for (const k of dayKeys) {
    days[k] = { scheduled: 0, dueNow: 0 };
  }

  for (const row of monthRows) {
    const key = calendarDayKey(timeZone, row.nextReviewAt);
    const cell = days[key];
    if (!cell) continue;
    cell.scheduled += 1;
    if (row.nextReviewAt <= now) {
      cell.dueNow += 1;
    }
  }

  return NextResponse.json({
    year,
    month,
    todayKey,
    dueNowTotal: dueNowRow?.count ?? 0,
    days,
  });
}
