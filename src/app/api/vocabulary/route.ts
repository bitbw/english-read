import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { vocabulary } from "@/lib/db/schema";
import { eq, and, desc, gte, lt, count } from "drizzle-orm";
import { getInitialReviewDate } from "@/lib/srs";
import {
  VOCABULARY_DAILY_ADD_LIMIT,
  VOCAB_DAILY_LIMIT_CODE,
  vocabularyZonedDayBounds,
} from "@/lib/vocabulary-daily-limit";
import { resolveTimeZone } from "@/lib/user-timezone";
import { NextResponse } from "next/server";
import { z } from "zod";

const addWordSchema = z.object({
  word: z.string().min(1).max(500),
  bookId: z.string().optional(),
  context: z.string().max(4000).optional(),
  contextCfi: z.string().optional(),
  definition: z.string().optional(),
  phonetic: z.string().optional(),
});

// GET /api/vocabulary?filter=all|pending|mastered&search=xxx
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const lookup = searchParams.get("lookup")?.trim();
  if (lookup) {
    const normalizedWord = lookup.toLowerCase();
    const [row] = await db
      .select()
      .from(vocabulary)
      .where(
        and(eq(vocabulary.userId, session.user.id), eq(vocabulary.normalizedWord, normalizedWord))
      )
      .limit(1);
    return NextResponse.json({ entry: row ?? null });
  }

  const filter = searchParams.get("filter") ?? "all";
  const search = searchParams.get("search") ?? "";

  const conditions = [eq(vocabulary.userId, session.user.id)];

  if (filter === "pending") {
    conditions.push(eq(vocabulary.isMastered, false));
  } else if (filter === "mastered") {
    conditions.push(eq(vocabulary.isMastered, true));
  }

  const query = db
    .select()
    .from(vocabulary)
    .where(and(...conditions))
    .orderBy(desc(vocabulary.createdAt));

  const words = await query;

  // 搜索过滤（在内存中做，因为 ilike 兼容性更好）
  const filtered = search
    ? words.filter((w) => w.word.toLowerCase().includes(search.toLowerCase()))
    : words;

  return NextResponse.json(filtered);
}

// POST /api/vocabulary
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = addWordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const normalizedWord = parsed.data.word.toLowerCase().trim();

  // 检查是否已存在
  const [existing] = await db
    .select()
    .from(vocabulary)
    .where(
      and(
        eq(vocabulary.userId, session.user.id),
        eq(vocabulary.normalizedWord, normalizedWord)
      )
    );

  if (existing) {
    return NextResponse.json({ ...existing, alreadyExists: true });
  }

  const timeZone = await resolveTimeZone(session.user.id, req);
  const { dayStart, dayEndExclusive } = vocabularyZonedDayBounds(timeZone);
  const [todayRow] = await db
    .select({ count: count() })
    .from(vocabulary)
    .where(
      and(
        eq(vocabulary.userId, session.user.id),
        gte(vocabulary.createdAt, dayStart),
        lt(vocabulary.createdAt, dayEndExclusive)
      )
    );

  if ((todayRow?.count ?? 0) >= VOCABULARY_DAILY_ADD_LIMIT) {
    return NextResponse.json(
      {
        code: VOCAB_DAILY_LIMIT_CODE,
        message: `今日已添加 ${VOCABULARY_DAILY_ADD_LIMIT} 个生词，请明天再继续`,
      },
      { status: 429 }
    );
  }

  const [word] = await db
    .insert(vocabulary)
    .values({
      userId: session.user.id,
      word: parsed.data.word.trim(),
      normalizedWord,
      bookId: parsed.data.bookId ?? null,
      context: parsed.data.context?.trim() || null,
      contextCfi: parsed.data.contextCfi ?? null,
      definition: parsed.data.definition ?? null,
      phonetic: parsed.data.phonetic ?? null,
      reviewStage: 0,
      nextReviewAt: getInitialReviewDate(timeZone),
    })
    .returning();

  return NextResponse.json(word, { status: 201 });
}
