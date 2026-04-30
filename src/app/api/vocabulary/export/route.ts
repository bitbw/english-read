import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { vocabulary } from "@/lib/db/schema";
import { and, desc, eq, ilike } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";
import { NextResponse } from "next/server";

const MAX_EXPORT_ROWS = 10_000;

function escapeIlikePattern(raw: string) {
  return raw.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

function csvCell(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

type VocabRow = InferSelectModel<typeof vocabulary>;

function toCsv(rows: VocabRow[]): string {
  const headers = [
    "word",
    "phonetic",
    "definition",
    "context",
    "note",
    "review_stage",
    "is_mastered",
    "next_review_at",
    "created_at",
    "book_id",
  ] as const;
  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push(
      [
        csvCell(r.word),
        csvCell(r.phonetic),
        csvCell(r.definition),
        csvCell(r.context),
        csvCell(r.note),
        csvCell(r.reviewStage),
        csvCell(r.isMastered),
        csvCell(r.nextReviewAt?.toISOString?.() ?? String(r.nextReviewAt)),
        csvCell(r.createdAt?.toISOString?.() ?? String(r.createdAt)),
        csvCell(r.bookId),
      ].join(",")
    );
  }
  return `\uFEFF${lines.join("\n")}\n`;
}

// GET /api/vocabulary/export?format=csv|json&filter=all|pending|mastered&search=
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const formatRaw = (searchParams.get("format") ?? "csv").toLowerCase();
  const format = formatRaw === "json" ? "json" : "csv";

  const filter = searchParams.get("filter") ?? "all";
  const search = (searchParams.get("search") ?? "").trim();

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

  const rows = await db
    .select()
    .from(vocabulary)
    .where(whereClause)
    .orderBy(desc(vocabulary.createdAt))
    .limit(MAX_EXPORT_ROWS + 1);

  if (rows.length > MAX_EXPORT_ROWS) {
    return NextResponse.json(
      {
        error: "Too many rows",
        message: `Export is limited to ${MAX_EXPORT_ROWS} rows. Narrow your filter or search and try again.`,
        maxRows: MAX_EXPORT_ROWS,
      },
      { status: 400 }
    );
  }

  const stamp = new Date().toISOString().slice(0, 10);

  if (format === "json") {
    const body = JSON.stringify(rows, null, 2);
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="vocabulary-${stamp}.json"`,
        "Cache-Control": "no-store",
      },
    });
  }

  const csv = toCsv(rows);
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="vocabulary-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
