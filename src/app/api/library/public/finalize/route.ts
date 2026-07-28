import { requireSessionApi } from "@/lib/api-session";
import { db } from "@/lib/db";
import { publicLibraryBooks } from "@/lib/db/schema";
import { assignPublicReadingTier } from "@/lib/assign-public-tier";
import { NextResponse } from "next/server";
import { z } from "zod";
import { validationError } from "@/lib/api-error";

const finalizeSchema = z.object({
  blobUrl: z.string().url("Blob URL must be a valid URL"),
  blobKey: z.string().min(1, "Blob key is required"),
  fileSize: z
    .number()
    .int("File size must be an integer")
    .positive("File size must be positive")
    .max(50 * 1024 * 1024, "File size must not exceed 50MB"),
  title: z
    .string()
    .min(1, "Title is required")
    .max(2000, "Title must not exceed 2,000 characters"),
  author: z.string().max(2000, "Author must not exceed 2,000 characters").optional(),
  coverUrl: z.string().url("Cover URL must be a valid URL").optional(),
});

/**
 * 客户端直传 Blob 完成后，仅提交元数据并写入公共书库（小 JSON，无 413）。
 */
export async function POST(req: Request) {
  const authResult = await requireSessionApi();
  if ("error" in authResult) return authResult.error;
  const { session } = authResult;

  const json = await req.json();
  const parsed = finalizeSchema.safeParse(json);
  if (!parsed.success) {
    return validationError(parsed.error);
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
