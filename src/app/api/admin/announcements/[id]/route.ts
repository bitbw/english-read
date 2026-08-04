import { requireAdminApi } from "@/lib/require-admin";
import { db } from "@/lib/db";
import { announcements } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import type { AnnouncementItem } from "@/app/api/announcements/route";

const updateSchema = z.object({
  titleZh: z.string().min(1).optional(),
  titleEn: z.string().optional().nullable(),
  contentZh: z.string().min(1).optional(),
  contentEn: z.string().optional().nullable(),
  linkUrl: z.string().optional().nullable(),
  linkLabelZh: z.string().optional().nullable(),
  linkLabelEn: z.string().optional().nullable(),
  priority: z.number().int().optional(),
  status: z.enum(["draft", "published", "archived"]).optional(),
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

// GET /api/admin/announcements/[id] — 获取单条公告
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminResult = await requireAdminApi();
  if ("error" in adminResult) return adminResult.error;

  const { id } = await params;

  const [row] = await db
    .select()
    .from(announcements)
    .where(eq(announcements.id, id))
    .limit(1);

  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(serializeAnnouncement(row));
}

// PUT /api/admin/announcements/[id] — 更新公告
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminResult = await requireAdminApi();
  if ("error" in adminResult) return adminResult.error;

  const { id } = await params;

  const [existing] = await db
    .select()
    .from(announcements)
    .where(eq(announcements.id, id))
    .limit(1);

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((e) => e.message).join("; ") },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const updateData: Record<string, unknown> = {};

  if (data.titleZh !== undefined) updateData.titleZh = data.titleZh;
  if (data.titleEn !== undefined) updateData.titleEn = data.titleEn;
  if (data.contentZh !== undefined) updateData.contentZh = data.contentZh;
  if (data.contentEn !== undefined) updateData.contentEn = data.contentEn;
  if (data.linkUrl !== undefined) updateData.linkUrl = data.linkUrl;
  if (data.linkLabelZh !== undefined) updateData.linkLabelZh = data.linkLabelZh;
  if (data.linkLabelEn !== undefined) updateData.linkLabelEn = data.linkLabelEn;
  if (data.priority !== undefined) updateData.priority = data.priority;
  if (data.status !== undefined) updateData.status = data.status;
  if (data.publishedAt !== undefined) updateData.publishedAt = data.publishedAt ? new Date(data.publishedAt) : null;
  if (data.expiresAt !== undefined) updateData.expiresAt = data.expiresAt ? new Date(data.expiresAt) : null;
  updateData.updatedAt = new Date();

  const [row] = await db
    .update(announcements)
    .set(updateData)
    .where(eq(announcements.id, id))
    .returning();

  return NextResponse.json(serializeAnnouncement(row));
}

// DELETE /api/admin/announcements/[id] — 删除公告
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminResult = await requireAdminApi();
  if ("error" in adminResult) return adminResult.error;

  const { id } = await params;

  const [existing] = await db
    .select()
    .from(announcements)
    .where(eq(announcements.id, id))
    .limit(1);

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db.delete(announcements).where(eq(announcements.id, id));

  return NextResponse.json({ success: true });
}