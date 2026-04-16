import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { books, publicLibraryBooks } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({
  publicBookId: z.string().uuid(),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { publicBookId } = parsed.data;
  const userId = session.user.id;

  const [pubRows, existingRows] = await Promise.all([
    db.select().from(publicLibraryBooks).where(eq(publicLibraryBooks.id, publicBookId)),
    db
      .select({ id: books.id })
      .from(books)
      .where(and(eq(books.userId, userId), eq(books.publicBookId, publicBookId))),
  ]);

  const pub = pubRows[0];
  if (!pub) {
    return NextResponse.json({ error: "Public book not found" }, { status: 404 });
  }

  const existing = existingRows[0];
  if (existing) {
    return NextResponse.json({ bookId: existing.id, alreadyAdded: true });
  }

  const [book] = await db
    .insert(books)
    .values({
      userId,
      title: pub.title,
      author: pub.author,
      coverUrl: pub.coverUrl,
      blobUrl: pub.blobUrl,
      blobKey: pub.blobKey,
      fileSize: pub.fileSize,
      publicBookId,
    })
    .returning();

  return NextResponse.json({ bookId: book.id, alreadyAdded: false });
}
