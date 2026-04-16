import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { publicLibraryBooks } from "@/lib/db/schema";
import { uploadPublicEpub } from "@/lib/blob";
import { parseEpubOpfMeta } from "@/lib/epub-opf-meta";
import { assignPublicReadingTier } from "@/lib/assign-public-tier";
import { getTierLabel } from "@/lib/reading-tiers";
import { NextResponse } from "next/server";

const MAX_FILE_SIZE = 50 * 1024 * 1024;

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (!file.name.toLowerCase().endsWith(".epub")) {
    return NextResponse.json({ error: "Only .epub files are allowed" }, { status: 400 });
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "File size exceeds 50MB limit" }, { status: 400 });
  }

  const buf = await file.arrayBuffer();
  let title = file.name.replace(/\.epub$/i, "").replace(/[-_]/g, " ").trim();
  let author = "";

  try {
    const meta = await parseEpubOpfMeta(buf);
    if (meta.title) title = meta.title;
    if (meta.author) author = meta.author;
  } catch {
    /* keep filename title */
  }

  const { tier, tierSource } = await assignPublicReadingTier(title, author);

  const { url, pathname } = await uploadPublicEpub(file);

  const [row] = await db
    .insert(publicLibraryBooks)
    .values({
      title,
      author: author || null,
      blobUrl: url,
      blobKey: pathname,
      fileSize: file.size,
      tier,
      tierSource,
      uploadedBy: session.user.id,
    })
    .returning();

  return NextResponse.json({
    id: row.id,
    title: row.title,
    tier: row.tier,
    tierLabel: getTierLabel(tier),
    tierSource: row.tierSource,
  });
}
