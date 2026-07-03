import { requireSessionApi } from "@/lib/api-session";
import { db } from "@/lib/db";
import { dailyArticles } from "@/lib/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

// GET /api/articles?level=1&page=1&pageSize=12
export async function GET(req: Request) {
  const authResult = await requireSessionApi();
  if ("error" in authResult) return authResult.error;

  const { searchParams } = new URL(req.url);
  const level = Math.max(1, Math.min(3, parseInt(searchParams.get("level") ?? "1", 10)));
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const pageSize = Math.min(24, Math.max(1, parseInt(searchParams.get("pageSize") ?? "12", 10)));
  const offset = (page - 1) * pageSize;

  const where = and(eq(dailyArticles.level, level));

  const [rows, countResult] = await Promise.all([
    db
      .select({
        id: dailyArticles.id,
        slug: dailyArticles.slug,
        level: dailyArticles.level,
        title: dailyArticles.title,
        description: dailyArticles.description,
        coverUrl: dailyArticles.coverUrl,
        wordCount: dailyArticles.wordCount,
        publishedAt: dailyArticles.publishedAt,
        createdAt: dailyArticles.createdAt,
      })
      .from(dailyArticles)
      .where(where)
      .orderBy(desc(dailyArticles.publishedAt), desc(dailyArticles.createdAt))
      .limit(pageSize)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(dailyArticles)
      .where(where),
  ]);

  const total = countResult[0]?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return NextResponse.json({ items: rows, page, pageSize, total, totalPages });
}
