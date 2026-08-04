import { requireAdminApi } from "@/lib/require-admin";
import { db } from "@/lib/db";
import { announcements } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import type { AnnouncementItem } from "@/app/api/announcements/route";

const createSchema = z.object({
  titleZh: z.string().min(1, "中文标题不能为空"),
  titleEn: z.string().optional().nullable(),
  contentZh: z.string().min(1, "中文内容不能为空"),
  contentEn: z.string().optional().nullable(),
  linkUrl: z.string().optional().nullable(),
  linkLabelZh: z.string().optional().nullable(),
  linkLabelEn: z.string().optional().nullable(),
  priority: z.number().int().default(0),
  status: z.enum(["draft", "published", "archived"]).default("draft"),
  publishedAt: z.string().optional().nullable(),
  expiresAt: z.string().optional().nullable(),
});

function serializeAnnouncement(r: typeof announcements.$inferSelect): AnnouncementItem {
  return {
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
  };
}

// GET /api/admin/announcements — 管理员获取全部公告
export async function GET() {
  const adminResult = await requireAdminApi();
  if ("error" in adminResult) return adminResult.error;

  const rows = await db
    .select()
    .from(announcements)
    .orderBy(desc(announcements.priority), desc(announcements.createdAt));

  return NextResponse.json({ announcements: rows.map(serializeAnnouncement) });
}

// POST /api/admin/announcements — 管理员创建公告
export async function POST(req: Request) {
  const adminResult = await requireAdminApi();
  if ("error" in adminResult) return adminResult.error;
  const session = adminResult.session;

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((e) => e.message).join("; ") },
      { status: 400 }
    );
  }

  const data = parsed.data;

  const [row] = await db
    .insert(announcements)
    .values({
      titleZh: data.titleZh,
      titleEn: data.titleEn ?? null,
      contentZh: data.contentZh,
      contentEn: data.contentEn ?? null,
      linkUrl: data.linkUrl ?? null,
      linkLabelZh: data.linkLabelZh ?? null,
      linkLabelEn: data.linkLabelEn ?? null,
      priority: data.priority,
      status: data.status,
      createdBy: session.user.id,
      publishedAt: data.publishedAt ? new Date(data.publishedAt) : null,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
    })
    .returning();

  return NextResponse.json(serializeAnnouncement(row), { status: 201 });
}