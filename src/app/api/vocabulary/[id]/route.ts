import { requireSessionApi } from "@/lib/api-session";
import { db } from "@/lib/db";
import { vocabulary } from "@/lib/db/schema";
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

const updateWordSchema = z.object({
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

  const [updated] = await db
    .update(vocabulary)
    .set({ ...parsed.data, updatedAt: new Date() })
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
