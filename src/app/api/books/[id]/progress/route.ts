import { requireSessionApi } from "@/lib/api-session";
import { db } from "@/lib/db";
import { books } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { validationError } from "@/lib/api-error";

const updateProgressSchema = z.object({
  currentCfi: z.string().optional(),
  readingProgress: z
    .number()
    .min(0, "Reading progress must be at least 0")
    .max(100, "Reading progress must not exceed 100")
    .optional(),
});

type IdParams = { params: Promise<{ id: string }> };

// GET /api/books/[id]/progress
export async function GET(_req: Request, { params }: IdParams) {
  const { id } = await params;
  const authResult = await requireSessionApi();
  if ("error" in authResult) return authResult.error;
  const { session } = authResult;

  const [book] = await db
    .select({
      currentCfi: books.currentCfi,
      readingProgress: books.readingProgress,
      lastReadAt: books.lastReadAt,
    })
    .from(books)
    .where(and(eq(books.id, id), eq(books.userId, session.user.id)));

  if (!book) {
    return NextResponse.json({ error: "Book not found" }, { status: 404 });
  }

  return NextResponse.json(book);
}

// PUT /api/books/[id]/progress
export async function PUT(req: Request, { params }: IdParams) {
  const { id } = await params;
  const authResult = await requireSessionApi();
  if ("error" in authResult) return authResult.error;
  const { session } = authResult;

  const body = await req.json();
  const parsed = updateProgressSchema.safeParse(body);
  if (!parsed.success) {
    return validationError(parsed.error);
  }

  await db
    .update(books)
    .set({
      ...parsed.data,
      lastReadAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(books.id, id), eq(books.userId, session.user.id)));

  return NextResponse.json({ success: true });
}
