import { requireSessionApi } from "@/lib/api-session";
import { db } from "@/lib/db";
import { announcements } from "@/lib/db/schema";
import { lte, gte, and, eq, isNull, or, desc } from "drizzle-orm";
import { NextResponse } from "next/server";

export type AnnouncementItem = {
  id: string;
  titleZh: string;
  titleEn: string | null;
  contentZh: string;
  contentEn: string | null;
  linkUrl: string | null;
  linkLabelZh: string | null;
  linkLabelEn: string | null;
  priority: number;
  status: "draft" | "published" | "archived";
  publishedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
};

// GET /api/announcements — 获取当前有效的公告
export async function GET() {
  const authResult = await requireSessionApi();
  if ("error" in authResult) return authResult.error;

  const now = new Date();

  const rows = await db
    .select()
    .from(announcements)
    .where(
      and(
        eq(announcements.status, "published"),
        or(isNull(announcements.publishedAt), lte(announcements.publishedAt, now)),
        or(isNull(announcements.expiresAt), gte(announcements.expiresAt, now))
      )
    )
    .orderBy(desc(announcements.priority), desc(announcements.publishedAt));

  const items: AnnouncementItem[] = rows.map((r) => ({
    id: r.id,
    titleZh: r.titleZh,
    titleEn: r.titleEn,
    contentZh: r.contentZh,
    contentEn: r.contentEn,
    linkUrl: r.linkUrl,
    linkLabelZh: r.linkLabelZh,
    linkLabelEn: r.linkLabelEn,
    priority: r.priority,
    status: r.status as "draft" | "published" | "archived",
    publishedAt: r.publishedAt?.toISOString() ?? null,
    expiresAt: r.expiresAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));

  return NextResponse.json({ announcements: items });
}