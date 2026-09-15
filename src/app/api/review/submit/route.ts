import { requireSessionApi } from "@/lib/api-session";
import { db } from "@/lib/db";
import { vocabulary, reviewLogs } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { calculateReviewTransition, type ReviewAction } from "@/lib/srs";
import { resolveTimeZone } from "@/lib/user-timezone";
import { NextResponse } from "next/server";
import { z } from "zod";
import { validationError } from "@/lib/api-error";

const submitSchema = z.object({
  vocabularyId: z.string().min(1, "vocabularyId is required"),
  action: z.enum(["advance", "remembered", "forgotten", "mastered"]).optional(),
  // 兼容旧客户端；新客户端使用 action。
  result: z.enum(["remembered", "forgotten"]).optional(),
}).refine((v) => v.action || v.result, {
  message: "action or result is required",
});

// POST /api/review/submit
export async function POST(req: Request) {
  const authResult = await requireSessionApi();
  if ("error" in authResult) return authResult.error;
  const { session } = authResult;

  const body = await req.json();
  const parsed = submitSchema.safeParse(body);
  if (!parsed.success) {
    return validationError(parsed.error);
  }

  const { vocabularyId } = parsed.data;
  const action = (parsed.data.action ?? parsed.data.result) as ReviewAction;

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
  let transition;
  try {
    transition = calculateReviewTransition(
      word.reviewStage,
      word.isMastered,
      action,
      timeZone,
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid review action" },
      { status: 400 },
    );
  }
  const { nextStage, nextReviewAt, isMastered } = transition;
  const result = action === "mastered" ? "mastered" : action === "forgotten" ? "forgotten" : "remembered";

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
