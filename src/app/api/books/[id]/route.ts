import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { books } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { deleteBlob } from "@/lib/blob";
import { NextResponse } from "next/server";

// GET /api/books/[id]
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [book] = await db
    .select()
    .from(books)
    .where(and(eq(books.id, params.id), eq(books.userId, session.user.id)));

  if (!book) {
    return NextResponse.json({ error: "Book not found" }, { status: 404 });
  }

  return NextResponse.json(book);
}

// DELETE /api/books/[id]
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [book] = await db
    .select()
    .from(books)
    .where(and(eq(books.id, params.id), eq(books.userId, session.user.id)));

  if (!book) {
    return NextResponse.json({ error: "Book not found" }, { status: 404 });
  }

  // 先删除 Blob 文件，再删除数据库记录
  await deleteBlob(book.blobUrl);
  if (book.coverUrl) await deleteBlob(book.coverUrl);

  await db
    .delete(books)
    .where(and(eq(books.id, params.id), eq(books.userId, session.user.id)));

  return NextResponse.json({ success: true });
}
