import { requireSessionApi } from "@/lib/api-session";
import { db } from "@/lib/db";
import { dailyArticles } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

// GET /api/articles/:id
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireSessionApi();
  if ("error" in authResult) return authResult.error;

  const { id } = await params;
  const [row] = await db
    .select()
    .from(dailyArticles)
    .where(eq(dailyArticles.id, id))
    .limit(1);

  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(row);
}
