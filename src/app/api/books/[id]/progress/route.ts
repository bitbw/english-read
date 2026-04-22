import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { books } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

const updateProgressSchema = z.object({
  currentCfi: z.string().optional(),
  readingProgress: z.number().min(0).max(100).optional(),
});

type IdParams = { params: Promise<{ id: string }> };

// GET /api/books/[id]/progress
export async function GET(_req: Request, { params }: IdParams) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = updateProgressSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
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
