import { auth } from "@/lib/auth";
import { deleteBlob } from "@/lib/blob";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

function isOurBlobUrl(url: string): boolean {
  return url.includes(".public.blob.vercel-storage.com/");
}

const patchSchema = z.object({
  name: z.union([z.string().max(80), z.null()]).optional(),
  /** 仅支持传 `null` 清除自定义头像（上传请走 POST /api/user/avatar） */
  image: z.null().optional(),
});

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ message: "未登录" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "无效的 JSON" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "参数无效" }, { status: 400 });
  }

  const { name: nameIn, image: imageIn } = parsed.data;
  if (nameIn === undefined && imageIn === undefined) {
    return NextResponse.json({ message: "无有效字段" }, { status: 400 });
  }

  let name: string | null | undefined;
  if (nameIn !== undefined) {
    if (nameIn === null) {
      name = null;
    } else {
      const trimmed = nameIn.trim();
      name = trimmed === "" ? null : trimmed;
    }
  }

  if (imageIn === null) {
    const [row] = await db
      .select({ image: users.image })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);
    if (row?.image && isOurBlobUrl(row.image)) {
      await deleteBlob(row.image);
    }
  }

  await db
    .update(users)
    .set({
      ...(name !== undefined ? { name } : {}),
      ...(imageIn !== undefined ? { image: null } : {}),
      updatedAt: new Date(),
    })
    .where(eq(users.id, session.user.id));

  const [row] = await db
    .select({ name: users.name, image: users.image })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  return NextResponse.json({
    ok: true,
    name: row?.name ?? null,
    image: row?.image ?? null,
  });
}
