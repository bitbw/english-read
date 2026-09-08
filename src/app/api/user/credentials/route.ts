import bcrypt from "bcryptjs";
import { eq, and, ne } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSessionApi } from "@/lib/api-session";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

const credentialsSchema = z
  .object({
    email: z.string().email("邮箱格式无效").optional().or(z.literal("")),
    password: z.string().min(8, "密码至少 8 位"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "两次输入的密码不一致",
    path: ["confirmPassword"],
  });

export async function PATCH(req: Request) {
  const authResult = await requireSessionApi();
  if ("error" in authResult) return authResult.error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "无效的 JSON" }, { status: 400 });
  }

  const parsed = credentialsSchema.safeParse(body);
  if (!parsed.success) {
    const firstError = Object.values(parsed.error.flatten().fieldErrors).flat()[0];
    return NextResponse.json({ message: firstError ?? "参数无效" }, { status: 400 });
  }

  const email = (parsed.data.email ?? "").trim().toLowerCase();
  const [currentUser] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, authResult.session.user.id))
    .limit(1);

  if (!currentUser) return NextResponse.json({ message: "用户不存在" }, { status: 404 });
  if (currentUser.email && email && currentUser.email !== email) {
    return NextResponse.json({ message: "邮箱设置后不能修改" }, { status: 400 });
  }
  if (!currentUser.email && !email) {
    return NextResponse.json({ message: "请填写邮箱" }, { status: 400 });
  }

  if (email) {
    const [emailOwner] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.email, email), ne(users.id, authResult.session.user.id)))
      .limit(1);
    if (emailOwner) return NextResponse.json({ message: "该邮箱已被其他账号使用" }, { status: 409 });
  }

  await db
    .update(users)
    .set({
      ...(currentUser.email ? {} : { email }),
      passwordHash: await bcrypt.hash(parsed.data.password, 12),
      updatedAt: new Date(),
    })
    .where(eq(users.id, authResult.session.user.id));

  return NextResponse.json({ ok: true, email: currentUser.email ?? email });
}

