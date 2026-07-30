import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { isValidIanaTimeZone } from "@/lib/user-timezone";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { validationError } from "@/lib/api-error";

const patchSchema = z
  .object({
    timeZone: z
      .union([
        z.string().min(1, "Time zone must not be empty").max(120, "Time zone must not exceed 120 characters"),
        z.null(),
      ])
      .optional(),
    showOnLeaderboard: z.boolean().optional(),
    articleLevel: z.number().int().min(1).max(3).optional(),
  })
  .refine((v) => v.timeZone !== undefined || v.showOnLeaderboard !== undefined || v.articleLevel !== undefined, {
    message: "At least one of timeZone, showOnLeaderboard, or articleLevel is required",
  });

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [row] = await db
    .select({
      timeZone: users.timeZone,
      showOnLeaderboard: users.showOnLeaderboard,
      articleLevel: users.articleLevel,
    })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  return NextResponse.json({
    timeZone: row?.timeZone ?? null,
    showOnLeaderboard: row?.showOnLeaderboard ?? true,
    articleLevel: row?.articleLevel ?? 1,
  });
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return validationError(parsed.error);
  }

  const updates: {
    timeZone?: string | null;
    showOnLeaderboard?: boolean;
    articleLevel?: number;
    updatedAt: Date;
  } = { updatedAt: new Date() };

  if (parsed.data.timeZone !== undefined) {
    const v = parsed.data.timeZone;
    if (v !== null && !isValidIanaTimeZone(v)) {
      return NextResponse.json({ error: "Invalid time zone" }, { status: 400 });
    }
    updates.timeZone = v === null ? null : v.trim();
  }

  if (parsed.data.showOnLeaderboard !== undefined) {
    updates.showOnLeaderboard = parsed.data.showOnLeaderboard;
  }

  if (parsed.data.articleLevel !== undefined) {
    updates.articleLevel = parsed.data.articleLevel;
  }

  await db.update(users).set(updates).where(eq(users.id, session.user.id));

  const [row] = await db
    .select({
      timeZone: users.timeZone,
      showOnLeaderboard: users.showOnLeaderboard,
      articleLevel: users.articleLevel,
    })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  return NextResponse.json({
    ok: true,
    timeZone: row?.timeZone ?? null,
    showOnLeaderboard: row?.showOnLeaderboard ?? true,
    articleLevel: row?.articleLevel ?? 1,
  });
}
