import { requireSessionApi } from "@/lib/api-session";
import { db } from "@/lib/db";
import { reviewDailyStats } from "@/lib/db/schema";
import { calendarDayKey } from "@/lib/user-calendar";
import { resolveTimeZone } from "@/lib/user-timezone";
import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { validationError } from "@/lib/api-error";

const postSchema = z
  .object({
    seconds: z
      .number()
      .int("Seconds must be an integer")
      .min(1, "Seconds must be at least 1")
      .max(120, "Seconds must not exceed 120")
      .optional(),
    errors: z
      .number()
      .int("Errors must be an integer")
      .min(1, "Errors must be at least 1")
      .max(50, "Errors must not exceed 50")
      .optional(),
  })
  .refine((v) => v.seconds != null || v.errors != null, {
    message: "At least one of seconds or errors is required",
  });

// POST /api/review/stats — 累加当日复习活跃秒数与错误次数
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
  const addSeconds = parsed.data.seconds ?? 0;
  const addErrors = parsed.data.errors ?? 0;

  await db
    .insert(reviewDailyStats)
    .values({
      userId: session.user.id,
      day,
      seconds: addSeconds,
      errorCount: addErrors,
    })
    .onConflictDoUpdate({
      target: [reviewDailyStats.userId, reviewDailyStats.day],
      set: {
        ...(addSeconds > 0
          ? { seconds: sql`${reviewDailyStats.seconds} + ${addSeconds}` }
          : {}),
        ...(addErrors > 0
          ? { errorCount: sql`${reviewDailyStats.errorCount} + ${addErrors}` }
          : {}),
        updatedAt: new Date(),
      },
    });

  return NextResponse.json({ ok: true });
}
