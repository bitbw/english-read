import type { AdminUserSummary } from "@/lib/admin-users-types";
import { db } from "@/lib/db";
import { readingDailyTime, reviewDailyStats, users } from "@/lib/db/schema";
import { requireAdminApi } from "@/lib/require-admin";
import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";

// GET /api/admin/users — 管理员用户列表
export async function GET() {
  const adminResult = await requireAdminApi();
  if ("error" in adminResult) return adminResult.error;

  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
      role: users.role,
      createdAt: users.createdAt,
      lastOnlineAt: users.lastOnlineAt,
      totalReadingSeconds: sql<number>`COALESCE((
        SELECT SUM(${readingDailyTime.seconds})
        FROM ${readingDailyTime}
        WHERE ${readingDailyTime.userId} = ${users.id}
      ), 0)`.mapWith(Number),
      totalReviewSeconds: sql<number>`COALESCE((
        SELECT SUM(${reviewDailyStats.seconds})
        FROM ${reviewDailyStats}
        WHERE ${reviewDailyStats.userId} = ${users.id}
      ), 0)`.mapWith(Number),
    })
    .from(users)
    .orderBy(sql`${users.lastOnlineAt} DESC NULLS LAST`, sql`${users.createdAt} DESC`);

  const payload: AdminUserSummary[] = rows.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    role: row.role,
    createdAt: row.createdAt.toISOString(),
    lastOnlineAt: row.lastOnlineAt?.toISOString() ?? null,
    totalReadingSeconds: row.totalReadingSeconds,
    totalReviewSeconds: row.totalReviewSeconds,
  }));

  return NextResponse.json({ users: payload });
}
