import { requireSessionApi } from "@/lib/api-session";
import { db } from "@/lib/db";
import { readingDailyTime } from "@/lib/db/schema";
import { calendarDayKey, calendarDayKeys } from "@/lib/user-calendar";
import { resolveTimeZone } from "@/lib/user-timezone";
import { and, eq, gte, lte, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { validationError } from "@/lib/api-error";

const postSchema = z.object({
  seconds: z
    .number()
    .int("Seconds must be an integer")
    .min(1, "Seconds must be at least 1")
    .max(120, "Seconds must not exceed 120"),
  /** 本会话区间内估算新增词数（仅 epubjs locations 生成后可统计） */
  words: z
    .number()
    .int("Words must be an integer")
    .min(0, "Words must not be negative")
    .max(50_000, "Words must not exceed 50,000")
    .optional(),
});

// POST /api/reading/time — 累加当日（学习时区自然日）阅读秒数与估算阅读词数（locations 就绪后上报）
export async function POST(req: Request) {
  const authResult = await requireSessionApi();
  if ("error" in authResult) return authResult.error;
  const { session } = authResult;

  const body = await req.json();
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return validationError(parsed.error);
  }

  const timeZone = await resolveTimeZone(session.user.id, req);
  const day = calendarDayKey(timeZone);
  const addSeconds = parsed.data.seconds;
  const addWords = parsed.data.words ?? 0;

  await db
    .insert(readingDailyTime)
    .values({
      userId: session.user.id,
      day,
      seconds: addSeconds,
      words: addWords,
    })
    .onConflictDoUpdate({
      target: [readingDailyTime.userId, readingDailyTime.day],
      set: {
        seconds: sql`${readingDailyTime.seconds} + ${addSeconds}`,
        ...(addWords > 0
          ? { words: sql`${readingDailyTime.words} + ${addWords}` }
          : {}),
        updatedAt: new Date(),
      },
    });

  return NextResponse.json({ ok: true });
}

// GET /api/reading/time?days=14
export async function GET(req: Request) {
  const authResult = await requireSessionApi();
  if ("error" in authResult) return authResult.error;
  const { session } = authResult;

  const { searchParams } = new URL(req.url);
  const raw = parseInt(searchParams.get("days") ?? "14", 10);
  const numDays = Number.isFinite(raw) ? Math.min(30, Math.max(7, raw)) : 14;

  const timeZone = await resolveTimeZone(session.user.id, req);
  const keys = calendarDayKeys(numDays, timeZone);
  const start = keys[0]!;
  const end = keys[keys.length - 1]!;

  const rows = await db
    .select({
      day: readingDailyTime.day,
      seconds: readingDailyTime.seconds,
      words: readingDailyTime.words,
    })
    .from(readingDailyTime)
    .where(
      and(
        eq(readingDailyTime.userId, session.user.id),
        gte(readingDailyTime.day, start),
        lte(readingDailyTime.day, end)
      )
    );

  const map = new Map(rows.map((r) => [r.day, { seconds: r.seconds, words: r.words }]));

  const series = keys.map((day) => {
    const v = map.get(day);
    return {
      day,
      seconds: v?.seconds ?? 0,
      words: v?.words ?? 0,
    };
  });

  return NextResponse.json({ days: numDays, series });
}
