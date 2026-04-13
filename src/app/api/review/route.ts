import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { vocabulary } from "@/lib/db/schema";
import { isValidPlanDayKey } from "@/lib/review-plan";
import { zonedDayRangeUtc } from "@/lib/user-calendar";
import { resolveTimeZone } from "@/lib/user-timezone";
import { eq, and, lte, notInArray, gte, lt } from "drizzle-orm";
import { NextResponse } from "next/server";

// GET /api/review - 待复习单词；无 date 为全部已到期；?date=YYYY-MM-DD 为指定「学习时区」自然日的计划；preview=1 可查看未来某日（仅浏览）
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const dateParam = url.searchParams.get("date");
  const preview = url.searchParams.get("preview") === "1";

  if (dateParam && !isValidPlanDayKey(dateParam)) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }

  const now = new Date();
  const timeZone = await resolveTimeZone(session.user.id, req);

  let dueWords;
  if (dateParam) {
    const { dayStart, dayEndExclusive } = zonedDayRangeUtc(dateParam, timeZone);
    const base = and(
      eq(vocabulary.userId, session.user.id),
      eq(vocabulary.isMastered, false),
      gte(vocabulary.nextReviewAt, dayStart),
      lt(vocabulary.nextReviewAt, dayEndExclusive)
    );
    dueWords = await db
      .select()
      .from(vocabulary)
      .where(preview ? base : and(base, lte(vocabulary.nextReviewAt, now)));
  } else {
    dueWords = await db
      .select()
      .from(vocabulary)
      .where(
        and(
          eq(vocabulary.userId, session.user.id),
          eq(vocabulary.isMastered, false),
          lte(vocabulary.nextReviewAt, now)
        )
      );
  }

  const dueIds = dueWords.map((w) => w.id);
  let distractorPool: { id: string; word: string; definition: string | null }[] = [];
  if (dueIds.length > 0) {
    distractorPool = await db
      .select({
        id: vocabulary.id,
        word: vocabulary.word,
        definition: vocabulary.definition,
      })
      .from(vocabulary)
      .where(
        and(
          eq(vocabulary.userId, session.user.id),
          eq(vocabulary.isMastered, false),
          notInArray(vocabulary.id, dueIds)
        )
      )
      .limit(120);
  }

  return NextResponse.json({
    words: dueWords,
    pool: distractorPool,
    preview: Boolean(dateParam && preview),
    date: dateParam ?? null,
  });
}
