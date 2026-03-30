import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { vocabulary } from "@/lib/db/schema";
import { eq, and, lte } from "drizzle-orm";
import { NextResponse } from "next/server";

// GET /api/review - 获取今日待复习单词
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  const dueWords = await db
    .select()
    .from(vocabulary)
    .where(
      and(
        eq(vocabulary.userId, session.user.id),
        eq(vocabulary.isMastered, false),
        lte(vocabulary.nextReviewAt, now)
      )
    );

  return NextResponse.json(dueWords);
}
