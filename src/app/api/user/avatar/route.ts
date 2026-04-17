import { auth } from "@/lib/auth";
import { deleteBlob, uploadAvatar } from "@/lib/blob";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

function isOurBlobUrl(url: string): boolean {
  return url.includes(".public.blob.vercel-storage.com/");
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ message: "未登录" }, { status: 401 });
  }

  const userId = session.user.id;
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ message: "无效的表单数据" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ message: "请选择图片文件" }, { status: 400 });
  }

  const [current] = await db
    .select({ image: users.image })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  let url: string;
  try {
    const uploaded = await uploadAvatar(userId, file);
    url = uploaded.url;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "上传失败";
    return NextResponse.json({ message: msg }, { status: 400 });
  }

  await db
    .update(users)
    .set({
      image: url,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));

  const previous = current?.image;
  if (previous && previous !== url && isOurBlobUrl(previous)) {
    await deleteBlob(previous);
  }

  return NextResponse.json({ ok: true, image: url });
}
