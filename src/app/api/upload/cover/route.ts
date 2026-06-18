import { requireSessionApi } from "@/lib/api-session";
import { uploadCover } from "@/lib/blob";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const authResult = await requireSessionApi();
  if ("error" in authResult) return authResult.error;
  const { session } = authResult;

  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  try {
    const { url, pathname } = await uploadCover(session.user.id, file);
    return NextResponse.json({ url, pathname, size: file.size });
  } catch (e) {
    const message = e instanceof Error ? e.message : "上传失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
