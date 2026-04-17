"use server";

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

const registerSchema = z
  .object({
    email: z
      .string()
      .email("邮箱格式无效")
      .transform((s) => s.toLowerCase().trim()),
    password: z.string().min(8, "密码至少 8 位"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "两次输入的密码不一致",
    path: ["confirmPassword"],
  });

export type RegisterResult =
  | { ok: true }
  | { ok: false; error: string };

export async function registerWithCredentials(input: {
  email: string;
  password: string;
  confirmPassword: string;
}): Promise<RegisterResult> {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) {
    const flat = parsed.error.flatten();
    const fieldErr = Object.values(flat.fieldErrors).flat()[0];
    const formErr = flat.formErrors[0];
    return { ok: false, error: fieldErr ?? formErr ?? "输入无效" };
  }

  const { email, password } = parsed.data;

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existing) {
    return { ok: false, error: "该邮箱已被注册" };
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await db.insert(users).values({
    email,
    passwordHash,
    updatedAt: new Date(),
  });

  return { ok: true };
}
