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
  })
  .refine((v) => v.timeZone !== undefined || v.showOnLeaderboard !== undefined, {
    message: "At least one of timeZone or showOnLeaderboard is required",
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
    })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  return NextResponse.json({
    timeZone: row?.timeZone ?? null,
    showOnLeaderboard: row?.showOnLeaderboard ?? true,
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

  await db.update(users).set(updates).where(eq(users.id, session.user.id));

  const [row] = await db
    .select({
      timeZone: users.timeZone,
      showOnLeaderboard: users.showOnLeaderboard,
    })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  return NextResponse.json({
    ok: true,
    timeZone: row?.timeZone ?? null,
    showOnLeaderboard: row?.showOnLeaderboard ?? true,
  });
}
