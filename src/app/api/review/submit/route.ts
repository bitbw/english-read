import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { vocabulary, reviewLogs } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { calculateNextReview } from "@/lib/srs";
import { resolveTimeZone } from "@/lib/user-timezone";
import { NextResponse } from "next/server";
import { z } from "zod";

const submitSchema = z.object({
  vocabularyId: z.string().min(1),
  result: z.enum(["remembered", "forgotten"]),
});

// POST /api/review/submit
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = submitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { vocabularyId, result } = parsed.data;

  const [wordRows, timeZone] = await Promise.all([
    db
      .select()
      .from(vocabulary)
      .where(
        and(
          eq(vocabulary.id, vocabularyId),
          eq(vocabulary.userId, session.user.id)
        )
      ),
    resolveTimeZone(session.user.id, req),
  ]);

  const word = wordRows[0];
  if (!word) {
    return NextResponse.json({ error: "Word not found" }, { status: 404 });
  }
  const { nextStage, nextReviewAt, isMastered } = calculateNextReview(
    word.reviewStage,
    result,
    timeZone
  );

  // neon-http 不支持 transaction；先更新词汇，写日志失败则回滚词汇，避免重试导致阶段连加
  const previous = {
    reviewStage: word.reviewStage,
    nextReviewAt: word.nextReviewAt,
    isMastered: word.isMastered,
    masteredAt: word.masteredAt,
    updatedAt: word.updatedAt,
  };

  await db
    .update(vocabulary)
    .set({
      reviewStage: nextStage,
      nextReviewAt,
      isMastered,
      masteredAt: isMastered ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(vocabulary.id, vocabularyId));

  try {
    await db.insert(reviewLogs).values({
      userId: session.user.id,
      vocabularyId,
      stageBeforeReview: word.reviewStage,
      result,
      stageAfterReview: nextStage,
      nextReviewAt,
    });
  } catch (err) {
    await db
      .update(vocabulary)
      .set({
        reviewStage: previous.reviewStage,
        nextReviewAt: previous.nextReviewAt,
        isMastered: previous.isMastered,
        masteredAt: previous.masteredAt,
        updatedAt: previous.updatedAt,
      })
      .where(eq(vocabulary.id, vocabularyId));
    console.error("[review/submit] review_logs insert failed, vocabulary reverted", err);
    return NextResponse.json({ error: "Failed to save review" }, { status: 500 });
  }

  return NextResponse.json({ nextStage, nextReviewAt, isMastered });
}
