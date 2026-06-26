import { db } from "@/lib/db";
import { books } from "@/lib/db/schema";
import { and, count, eq, isNull } from "drizzle-orm";

/** 个人书架自行上传 EPUB 的上限（不含从公共书库加入的书） */
export const MAX_SELF_UPLOADED_BOOKS = 3;

export const BOOKSHELF_UPLOAD_LIMIT_CODE = "BOOKSHELF_UPLOAD_LIMIT" as const;

export async function countSelfUploadedBooks(userId: string): Promise<number> {
  const [row] = await db
    .select({ count: count() })
    .from(books)
    .where(and(eq(books.userId, userId), isNull(books.publicBookId)));

  return row?.count ?? 0;
}

export function isSelfUploadLimitReached(currentCount: number): boolean {
  return currentCount >= MAX_SELF_UPLOADED_BOOKS;
}
