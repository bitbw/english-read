import { auth } from "@/lib/auth";
import { deleteBlob } from "@/lib/blob";
import { db } from "@/lib/db";
import { books, publicLibraryBooks } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

type IdParams = { params: Promise<{ id: string }> };

// DELETE /api/library/public/[id] — 仅上传者可删；删除公共条目及关联的个人书架副本（同一 EPUB Blob），再删 Blob
export async function DELETE(_req: Request, { params }: IdParams) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const [pub] = await db.select().from(publicLibraryBooks).where(eq(publicLibraryBooks.id, id));
  if (!pub) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (pub.uploadedBy !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const shelfRows = await db
    .select({ id: books.id })
    .from(books)
    .where(eq(books.publicBookId, id));

  /** 移除所有用户从该书加入书架的个人副本（生词本的 book_id 会按 FK 置空） */
  for (const row of shelfRows) {
    await db.delete(books).where(and(eq(books.id, row.id)));
  }

  await db.delete(publicLibraryBooks).where(eq(publicLibraryBooks.id, id));

  await deleteBlob(pub.blobUrl);
  if (pub.coverUrl?.trim()) {
    await deleteBlob(pub.coverUrl.trim());
  }

  return NextResponse.json({
    success: true,
    removedShelfCopies: shelfRows.length,
  });
}
