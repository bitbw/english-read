import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { readingDailyTime } from "@/lib/db/schema";
import { utcDayKeys, utcDayString } from "@/lib/reading-time";
import { and, eq, gte, lte, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

const postSchema = z.object({
  seconds: z.number().int().min(1).max(120),
});

// POST /api/reading/time — 累加当日（UTC）阅读秒数
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const day = utcDayString();
  const add = parsed.data.seconds;

  await db
    .insert(readingDailyTime)
    .values({
      userId: session.user.id,
      day,
      seconds: add,
    })
    .onConflictDoUpdate({
      target: [readingDailyTime.userId, readingDailyTime.day],
      set: {
        seconds: sql`${readingDailyTime.seconds} + ${add}`,
        updatedAt: new Date(),
      },
    });

  return NextResponse.json({ ok: true });
}

// GET /api/reading/time?days=14
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const raw = parseInt(searchParams.get("days") ?? "14", 10);
  const numDays = Number.isFinite(raw) ? Math.min(30, Math.max(7, raw)) : 14;

  const keys = utcDayKeys(numDays);
  const start = keys[0]!;
  const end = keys[keys.length - 1]!;

  const rows = await db
    .select({ day: readingDailyTime.day, seconds: readingDailyTime.seconds })
    .from(readingDailyTime)
    .where(
      and(
        eq(readingDailyTime.userId, session.user.id),
        gte(readingDailyTime.day, start),
        lte(readingDailyTime.day, end)
      )
    );

  const map = new Map(rows.map((r) => [r.day, r.seconds]));

  const series = keys.map((day) => ({
    day,
    seconds: map.get(day) ?? 0,
  }));

  return NextResponse.json({ days: numDays, series });
}
