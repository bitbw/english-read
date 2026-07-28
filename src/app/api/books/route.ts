import { requireSessionApi } from "@/lib/api-session";
import {
  BOOKSHELF_UPLOAD_LIMIT_CODE,
  MAX_SELF_UPLOADED_BOOKS,
  countSelfUploadedBooks,
  isSelfUploadLimitReached,
} from "@/lib/bookshelf-limits";
import { db } from "@/lib/db";
import { books } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { validationError } from "@/lib/api-error";

const createBookSchema = z.object({
  title: z.string().min(1, "Title is required"),
  author: z.string().optional(),
  coverUrl: z.string().url("Cover URL must be a valid URL").optional(),
  blobUrl: z.string().url("Blob URL is required and must be a valid URL"),
  blobKey: z.string().min(1, "Blob key is required"),
  fileSize: z.number().optional(),
});

// GET /api/books - 获取当前用户书库
export async function GET() {
  const authResult = await requireSessionApi();
  if ("error" in authResult) return authResult.error;
  const { session } = authResult;

  const userBooks = await db
    .select()
    .from(books)
    .where(eq(books.userId, session.user.id))
    .orderBy(desc(books.lastReadAt), desc(books.createdAt));

  return NextResponse.json(userBooks);
}

// POST /api/books - 创建书籍记录
export async function POST(req: Request) {
  const authResult = await requireSessionApi();
  if ("error" in authResult) return authResult.error;
  const { session } = authResult;

  const body = await req.json();
  const parsed = createBookSchema.safeParse(body);
  if (!parsed.success) {
    return validationError(parsed.error);
  }

  const selfUploadedCount = await countSelfUploadedBooks(session.user.id);
  if (isSelfUploadLimitReached(selfUploadedCount)) {
    return NextResponse.json(
      {
        code: BOOKSHELF_UPLOAD_LIMIT_CODE,
        message: `个人书架最多上传 ${MAX_SELF_UPLOADED_BOOKS} 本书，请删除旧书后再试，或从公共书库添加书籍`,
      },
      { status: 403 },
    );
  }

  const [book] = await db
    .insert(books)
    .values({
      userId: session.user.id,
      ...parsed.data,
    })
    .returning();

  return NextResponse.json(book, { status: 201 });
}
