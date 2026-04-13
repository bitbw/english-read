import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { isValidIanaTimeZone } from "@/lib/user-timezone";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

const patchSchema = z.object({
  timeZone: z.union([z.string().min(1).max(120), z.null()]),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [row] = await db
    .select({ timeZone: users.timeZone })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  return NextResponse.json({ timeZone: row?.timeZone ?? null });
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const v = parsed.data.timeZone;
  if (v !== null && !isValidIanaTimeZone(v)) {
    return NextResponse.json({ error: "Invalid time zone" }, { status: 400 });
  }

  const stored = v === null ? null : v.trim();

  await db
    .update(users)
    .set({
      timeZone: stored,
      updatedAt: new Date(),
    })
    .where(eq(users.id, session.user.id));

  return NextResponse.json({ ok: true, timeZone: stored });
}
