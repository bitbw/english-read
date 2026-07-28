import { requireSessionApi } from "@/lib/api-session";
import { db } from "@/lib/db";
import { books } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { deleteBlob } from "@/lib/blob";
import { NextResponse } from "next/server";
import { validationError } from "@/lib/api-error";
import { z } from "zod";

const patchBookSchema = z.object({
  coverUrl: z.union([z.string().url("Cover URL must be a valid URL"), z.null()]),
});

type IdParams = { params: Promise<{ id: string }> };

// GET /api/books/[id]
export async function GET(_req: Request, { params }: IdParams) {
  const { id } = await params;
  const authResult = await requireSessionApi();
  if ("error" in authResult) return authResult.error;
  const { session } = authResult;

  const [book] = await db
    .select()
    .from(books)
    .where(and(eq(books.id, id), eq(books.userId, session.user.id)));

  if (!book) {
    return NextResponse.json({ error: "Book not found" }, { status: 404 });
  }

  return NextResponse.json(book);
}

// PATCH /api/books/[id] — 更新封面等
export async function PATCH(req: Request, { params }: IdParams) {
  const { id } = await params;
  const authResult = await requireSessionApi();
  if ("error" in authResult) return authResult.error;
  const { session } = authResult;
  const body = await req.json();
  const parsed = patchBookSchema.safeParse(body);
  if (!parsed.success) {
    return validationError(parsed.error);
  }

  const [existing] = await db
    .select()
    .from(books)
    .where(and(eq(books.id, id), eq(books.userId, session.user.id)));

  if (!existing) {
    return NextResponse.json({ error: "Book not found" }, { status: 404 });
  }

  if (existing.publicBookId) {
    return NextResponse.json(
      { error: "来自公共书库的书籍不支持更换封面" },
      { status: 400 }
    );
  }

  const { coverUrl } = parsed.data;
  const prevCover = existing.coverUrl;

  if (coverUrl === prevCover) {
    return NextResponse.json(existing);
  }

  const [updated] = await db
    .update(books)
    .set({
      coverUrl,
      updatedAt: new Date(),
    })
    .where(and(eq(books.id, id), eq(books.userId, session.user.id)))
    .returning();

  if (prevCover && prevCover !== coverUrl) {
    void deleteBlob(prevCover);
  }

  return NextResponse.json(updated);
}

// DELETE /api/books/[id]
export async function DELETE(_req: Request, { params }: IdParams) {
  const { id } = await params;
  const authResult = await requireSessionApi();
  if ("error" in authResult) return authResult.error;
  const { session } = authResult;

  const [book] = await db
    .select()
    .from(books)
    .where(and(eq(books.id, id), eq(books.userId, session.user.id)));

  if (!book) {
    return NextResponse.json({ error: "Book not found" }, { status: 404 });
  }

  /**
   * 仅从书架移除个人记录。若该书来自公共书库（publicBookId），EPUB/封面 Blob 与公共条目共用同一 URL，
   * 不得 deleteBlob，否则会把公共书库的文件一并删掉。
   * 私有上传无 publicBookId，删除书架条目时同时删除个人 Blob。
   */
  if (!book.publicBookId) {
    await deleteBlob(book.blobUrl);
    if (book.coverUrl) await deleteBlob(book.coverUrl);
  }

  await db
    .delete(books)
    .where(and(eq(books.id, id), eq(books.userId, session.user.id)));

  return NextResponse.json({ success: true });
}
