import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { vocabulary, reviewLogs } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { calculateNextReview } from "@/lib/srs";
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

  const [word] = await db
    .select()
    .from(vocabulary)
    .where(
      and(
        eq(vocabulary.id, vocabularyId),
        eq(vocabulary.userId, session.user.id)
      )
    );

  if (!word) {
    return NextResponse.json({ error: "Word not found" }, { status: 404 });
  }

  const { nextStage, nextReviewAt, isMastered } = calculateNextReview(
    word.reviewStage,
    result
  );

  // 事务：更新单词状态 + 写入复习日志
  await db.transaction(async (tx) => {
    await tx
      .update(vocabulary)
      .set({
        reviewStage: nextStage,
        nextReviewAt,
        isMastered,
        masteredAt: isMastered ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(vocabulary.id, vocabularyId));

    await tx.insert(reviewLogs).values({
      userId: session.user.id,
      vocabularyId,
      stageBeforeReview: word.reviewStage,
      result,
      stageAfterReview: nextStage,
      nextReviewAt,
    });
  });

  return NextResponse.json({ nextStage, nextReviewAt, isMastered });
}
