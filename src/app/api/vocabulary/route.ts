import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { vocabulary } from "@/lib/db/schema";
import { eq, and, desc, gte, lt, count, ilike, sql } from "drizzle-orm";
import { getInitialReviewDate } from "@/lib/srs";
import {
  VOCABULARY_DAILY_ADD_LIMIT,
  VOCAB_DAILY_LIMIT_CODE,
  vocabularyZonedDayBounds,
} from "@/lib/vocabulary-daily-limit";
import { resolveTimeZone } from "@/lib/user-timezone";
import { NextResponse } from "next/server";
import { z } from "zod";

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;

function escapeIlikePattern(raw: string) {
  return raw.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

const addWordSchema = z.object({
  word: z.string().min(1).max(500),
  bookId: z.string().optional(),
  context: z.string().max(4000).optional(),
  contextCfi: z.string().optional(),
  definition: z.string().optional(),
  phonetic: z.string().optional(),
  audioUk: z.string().max(2048).optional(),
  audioUs: z.string().max(2048).optional(),
});

// GET /api/vocabulary?filter=all|pending|mastered&search=xxx&page=1&pageSize=50
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
  const searchRaw = searchParams.get("search") ?? "";
  const search = searchRaw.trim();

  const parsedPage = parseInt(searchParams.get("page") ?? "1", 10);
  const page = Math.max(1, Number.isFinite(parsedPage) ? parsedPage : 1);
  const parsedSize = parseInt(
    searchParams.get("pageSize") ?? String(DEFAULT_PAGE_SIZE),
    10
  );
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Number.isFinite(parsedSize) ? parsedSize : DEFAULT_PAGE_SIZE)
  );
  const offset = (page - 1) * pageSize;

  const conditions = [eq(vocabulary.userId, session.user.id)];

  if (filter === "pending") {
    conditions.push(eq(vocabulary.isMastered, false));
  } else if (filter === "mastered") {
    conditions.push(eq(vocabulary.isMastered, true));
  }

  if (search) {
    const pattern = `%${escapeIlikePattern(search)}%`;
    conditions.push(ilike(vocabulary.word, pattern));
  }

  const whereClause = and(...conditions);

  const [rows, countResult] = await Promise.all([
    db
      .select()
      .from(vocabulary)
      .where(whereClause)
      .orderBy(desc(vocabulary.createdAt))
      .limit(pageSize)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(vocabulary)
      .where(whereClause),
  ]);

  const total = countResult[0]?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return NextResponse.json({
    items: rows,
    page,
    pageSize,
    total,
    totalPages,
  });
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

  const [existingRows, timeZone] = await Promise.all([
    db
      .select()
      .from(vocabulary)
      .where(
        and(
          eq(vocabulary.userId, session.user.id),
          eq(vocabulary.normalizedWord, normalizedWord)
        )
      ),
    resolveTimeZone(session.user.id, req),
  ]);

  const existing = existingRows[0];
  if (existing) {
    return NextResponse.json({ ...existing, alreadyExists: true });
  }
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
      audioUk: parsed.data.audioUk?.trim() || null,
      audioUs: parsed.data.audioUs?.trim() || null,
      reviewStage: 0,
      nextReviewAt: getInitialReviewDate(timeZone),
    })
    .returning();

  return NextResponse.json(word, { status: 201 });
}
