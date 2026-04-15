import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

const patchSchema = z.object({
  name: z.union([z.string().max(80), z.null()]),
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

  let name: string | null;
  if (parsed.data.name === null) {
    name = null;
  } else {
    const trimmed = parsed.data.name.trim();
    name = trimmed === "" ? null : trimmed;
  }

  await db
    .update(users)
    .set({
      name,
      updatedAt: new Date(),
    })
    .where(eq(users.id, session.user.id));

  return NextResponse.json({ ok: true, name });
}
