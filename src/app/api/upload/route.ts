import { auth } from "@/lib/auth";
import { put } from "@vercel/blob";
import { NextResponse } from "next/server";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

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
