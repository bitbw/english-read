import { z } from "zod";
import { NextResponse } from "next/server";

/**
 * 统一的 Zod 校验失败响应。
 * 提取第一条字段错误作为人类可读的 message，返回 400。
 *
 * 用法：
 *   const parsed = schema.safeParse(body);
 *   if (!parsed.success) return validationError(parsed.error);
 */
export function validationError(zodError: z.ZodError) {
  const flat = z.flattenError(zodError);
  const firstFieldError = Object.values(flat.fieldErrors).flat()[0];
  return NextResponse.json(
    { message: firstFieldError || "请求参数校验失败" },
    { status: 400 },
  );
}