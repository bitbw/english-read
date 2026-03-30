import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { vocabulary } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

const updateWordSchema = z.object({
  note: z.string().optional(),
  definition: z.string().optional(),
  phonetic: z.string().optional(),
});

// GET /api/vocabulary/[id]
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [word] = await db
    .select()
    .from(vocabulary)
    .where(and(eq(vocabulary.id, params.id), eq(vocabulary.userId, session.user.id)));

  if (!word) {
    return NextResponse.json({ error: "Word not found" }, { status: 404 });
  }

  return NextResponse.json(word);
}

// PUT /api/vocabulary/[id]
export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = updateWordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const [updated] = await db
    .update(vocabulary)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(and(eq(vocabulary.id, params.id), eq(vocabulary.userId, session.user.id)))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Word not found" }, { status: 404 });
  }

  return NextResponse.json(updated);
}

// DELETE /api/vocabulary/[id]
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const deleted = await db
    .delete(vocabulary)
    .where(and(eq(vocabulary.id, params.id), eq(vocabulary.userId, session.user.id)))
    .returning();

  if (!deleted.length) {
    return NextResponse.json({ error: "Word not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
