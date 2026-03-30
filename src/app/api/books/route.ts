import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { books } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

const createBookSchema = z.object({
  title: z.string().min(1),
  author: z.string().optional(),
  coverUrl: z.string().url().optional(),
  blobUrl: z.string().url(),
  blobKey: z.string().min(1),
  fileSize: z.number().optional(),
});

// GET /api/books - 获取当前用户书库
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userBooks = await db
    .select()
    .from(books)
    .where(eq(books.userId, session.user.id))
    .orderBy(desc(books.lastReadAt), desc(books.createdAt));

  return NextResponse.json(userBooks);
}

// POST /api/books - 创建书籍记录
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = createBookSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
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
