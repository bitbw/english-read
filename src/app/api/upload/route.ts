import { requireSessionApi } from "@/lib/api-session";
import {
  BOOKSHELF_UPLOAD_LIMIT_CODE,
  MAX_SELF_UPLOADED_BOOKS,
  countSelfUploadedBooks,
  isSelfUploadLimitReached,
} from "@/lib/bookshelf-limits";
import { put } from "@vercel/blob";
import { NextResponse } from "next/server";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(req: Request) {
  const authResult = await requireSessionApi();
  if ("error" in authResult) return authResult.error;
  const { session } = authResult;

  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (!file.name.toLowerCase().endsWith(".epub")) {
    return NextResponse.json({ error: "Only .epub files are allowed" }, { status: 400 });
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "File size exceeds 10MB limit" }, { status: 400 });
  }

  const selfUploadedCount = await countSelfUploadedBooks(session.user.id);
  if (isSelfUploadLimitReached(selfUploadedCount)) {
    return NextResponse.json(
      {
        code: BOOKSHELF_UPLOAD_LIMIT_CODE,
        message: `个人书架最多上传 ${MAX_SELF_UPLOADED_BOOKS} 本书，请删除旧书后再试，或从公共书库添加书籍`,
      },
      { status: 403 },
    );
  }

  const safeName = file.name.replace(/\s+/g, "-").replace(/[^\w\-_.]/g, "");
  const pathname = `epubs/${session.user.id}/${Date.now()}-${safeName}`;

  const blob = await put(pathname, file, {
    access: "public",
    contentType: "application/epub+zip",
  });

  return NextResponse.json({
    url: blob.url,
    pathname: blob.pathname,
    size: file.size,
  });
}
