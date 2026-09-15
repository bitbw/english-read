import { requireSessionApi } from "@/lib/api-session";
import { db } from "@/lib/db";
import { reviewLogs, vocabulary } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import {
  VOCAB_AUDIO_URL_MAX_LENGTH,
  VOCAB_DEFINITION_MAX_LENGTH,
  VOCAB_NOTE_MAX_LENGTH,
  VOCAB_PHONETIC_MAX_LENGTH,
} from "@/lib/vocabulary-limits";
import { NextResponse } from "next/server";
import { z } from "zod";
import { validationError } from "@/lib/api-error";
import { calculateReviewTransition, type ReviewAction } from "@/lib/srs";
import { resolveTimeZone } from "@/lib/user-timezone";

const updateWordSchema = z.object({
  status: z.enum(["remembered", "forgotten", "mastered"]).optional(),
  note: z
    .string()
    .max(VOCAB_NOTE_MAX_LENGTH, `Note must not exceed ${VOCAB_NOTE_MAX_LENGTH} characters`)
    .optional(),
  definition: z
    .string()
    .max(VOCAB_DEFINITION_MAX_LENGTH, `Definition must not exceed ${VOCAB_DEFINITION_MAX_LENGTH} characters`)
    .optional(),
  phonetic: z
    .string()
    .max(VOCAB_PHONETIC_MAX_LENGTH, `Phonetic must not exceed ${VOCAB_PHONETIC_MAX_LENGTH} characters`)
    .optional(),
  audioUk: z
    .string()
    .max(VOCAB_AUDIO_URL_MAX_LENGTH, `Audio URL must not exceed ${VOCAB_AUDIO_URL_MAX_LENGTH} characters`)
    .optional()
    .nullable(),
  audioUs: z
    .string()
    .max(VOCAB_AUDIO_URL_MAX_LENGTH, `Audio URL must not exceed ${VOCAB_AUDIO_URL_MAX_LENGTH} characters`)
    .optional()
    .nullable(),
});

type IdParams = { params: Promise<{ id: string }> };

// GET /api/vocabulary/[id]
export async function GET(_req: Request, { params }: IdParams) {
  const { id } = await params;
  const authResult = await requireSessionApi();
  if ("error" in authResult) return authResult.error;
  const { session } = authResult;

  const [word] = await db
    .select()
    .from(vocabulary)
    .where(and(eq(vocabulary.id, id), eq(vocabulary.userId, session.user.id)));

  if (!word) {
    return NextResponse.json({ error: "Word not found" }, { status: 404 });
  }

  return NextResponse.json(word);
}

// PUT /api/vocabulary/[id]
export async function PUT(req: Request, { params }: IdParams) {
  const { id } = await params;
  const authResult = await requireSessionApi();
  if ("error" in authResult) return authResult.error;
  const { session } = authResult;

  const body = await req.json();
  const parsed = updateWordSchema.safeParse(body);
  if (!parsed.success) {
    return validationError(parsed.error);
  }

  const { status, ...wordPatch } = parsed.data;
  if (status) {
    const [word, timeZone] = await Promise.all([
      db
        .select()
        .from(vocabulary)
        .where(and(eq(vocabulary.id, id), eq(vocabulary.userId, session.user.id))),
      resolveTimeZone(session.user.id, req),
    ]);
    const current = word[0];
    if (!current) {
      return NextResponse.json({ error: "Word not found" }, { status: 404 });
    }

    let transition;
    try {
      transition = calculateReviewTransition(
        current.reviewStage,
        current.isMastered,
        status as ReviewAction,
        timeZone,
      );
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Invalid vocabulary status" },
        { status: 400 },
      );
    }

    const [updated] = await db
      .update(vocabulary)
      .set({
        reviewStage: transition.nextStage,
        nextReviewAt: transition.nextReviewAt,
        isMastered: transition.isMastered,
        masteredAt: transition.isMastered ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(and(eq(vocabulary.id, id), eq(vocabulary.userId, session.user.id)))
      .returning();

    try {
      await db.insert(reviewLogs).values({
        userId: session.user.id,
        vocabularyId: id,
        stageBeforeReview: current.reviewStage,
        result: status === "mastered" ? "mastered" : status,
        stageAfterReview: transition.nextStage,
        nextReviewAt: transition.nextReviewAt,
      });
    } catch (error) {
      await db
        .update(vocabulary)
        .set({
          reviewStage: current.reviewStage,
          nextReviewAt: current.nextReviewAt,
          isMastered: current.isMastered,
          masteredAt: current.masteredAt,
          updatedAt: current.updatedAt,
        })
        .where(and(eq(vocabulary.id, id), eq(vocabulary.userId, session.user.id)));
      console.error("[vocabulary/status] review_logs insert failed, vocabulary reverted", error);
      return NextResponse.json({ error: "Failed to save status" }, { status: 500 });
    }

    return NextResponse.json(updated);
  }

  const [updated] = await db
    .update(vocabulary)
    .set({ ...wordPatch, updatedAt: new Date() })
    .where(and(eq(vocabulary.id, id), eq(vocabulary.userId, session.user.id)))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Word not found" }, { status: 404 });
  }

  return NextResponse.json(updated);
}

// DELETE /api/vocabulary/[id]
export async function DELETE(_req: Request, { params }: IdParams) {
  const { id } = await params;
  const authResult = await requireSessionApi();
  if ("error" in authResult) return authResult.error;
  const { session } = authResult;

  const deleted = await db
    .delete(vocabulary)
    .where(and(eq(vocabulary.id, id), eq(vocabulary.userId, session.user.id)))
    .returning();

  if (!deleted.length) {
    return NextResponse.json({ error: "Word not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
