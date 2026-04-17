import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { publicLibraryBooks, users } from "@/lib/db/schema";
import { eq, desc, sql, and, or, ilike } from "drizzle-orm";
import { NextResponse } from "next/server";
import { isReadingTierId } from "@/lib/reading-tiers";

const PAGE_SIZE = 24;

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const tier = searchParams.get("tier")?.trim();
  const q = searchParams.get("q")?.trim();
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const conditions = [];
  if (tier && isReadingTierId(tier)) {
    conditions.push(eq(publicLibraryBooks.tier, tier));
  }
  if (q) {
    const pattern = `%${q.replace(/%/g, "\\%")}%`;
    conditions.push(
      or(
        ilike(publicLibraryBooks.title, pattern),
        ilike(publicLibraryBooks.author, pattern)
      )!
    );
  }

  const whereClause = conditions.length ? and(...conditions) : sql`true`;

  const [rows, countResult] = await Promise.all([
    db
      .select({
        id: publicLibraryBooks.id,
        title: publicLibraryBooks.title,
        author: publicLibraryBooks.author,
        coverUrl: publicLibraryBooks.coverUrl,
        blobUrl: publicLibraryBooks.blobUrl,
        tier: publicLibraryBooks.tier,
        fileSize: publicLibraryBooks.fileSize,
        createdAt: publicLibraryBooks.createdAt,
        uploaderName: users.name,
      })
      .from(publicLibraryBooks)
      .leftJoin(users, eq(publicLibraryBooks.uploadedBy, users.id))
      .where(whereClause)
      .orderBy(desc(publicLibraryBooks.createdAt))
      .limit(PAGE_SIZE)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(publicLibraryBooks)
      .where(whereClause),
  ]);

  const total = countResult[0]?.count ?? 0;

  return NextResponse.json({
    items: rows,
    page,
    pageSize: PAGE_SIZE,
    total,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  });
}
