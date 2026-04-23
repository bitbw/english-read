import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { publicLibraryBooks } from "@/lib/db/schema";
import { assignPublicReadingTier } from "@/lib/assign-public-tier";
import { NextResponse } from "next/server";
import { z } from "zod";

const finalizeSchema = z.object({
  blobUrl: z.string().url(),
  blobKey: z.string().min(1),
  fileSize: z.number().int().positive().max(50 * 1024 * 1024),
  title: z.string().min(1).max(2000),
  author: z.string().max(2000).optional(),
  coverUrl: z.string().url().optional(),
});

/**
 * 客户端直传 Blob 完成后，仅提交元数据并写入公共书库（小 JSON，无 413）。
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = await req.json();
  const parsed = finalizeSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { blobUrl, blobKey, fileSize, title, author, coverUrl } = parsed.data;

  if (!blobKey.startsWith("epubs/public/")) {
    return NextResponse.json({ error: "Invalid blob key" }, { status: 400 });
  }

  const { tier, tierSource } = await assignPublicReadingTier(title, author ?? "");

  const [row] = await db
    .insert(publicLibraryBooks)
    .values({
      title,
      author: author?.trim() ? author.trim() : null,
      coverUrl: coverUrl ?? null,
      blobUrl,
      blobKey,
      fileSize,
      tier,
      tierSource,
      uploadedBy: session.user.id,
    })
    .returning();

  return NextResponse.json({
    id: row.id,
    title: row.title,
    tier: row.tier,
    tierSource: row.tierSource,
  });
}
