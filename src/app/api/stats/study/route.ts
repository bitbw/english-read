import { requireSessionApi } from "@/lib/api-session";
import { requireAdminApi } from "@/lib/require-admin";
import { getStudyStats, resolveStudyDayRange } from "@/lib/study-stats";
import { resolveTimeZone } from "@/lib/user-timezone";
import { NextResponse } from "next/server";

// GET /api/stats/study?days=14 | ?start=&end= | ?userId= (admin)
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const targetUserIdParam = searchParams.get("userId");

  let userId: string;

  if (targetUserIdParam) {
    const adminResult = await requireAdminApi();
    if ("error" in adminResult) return adminResult.error;
    userId = targetUserIdParam;
  } else {
    const authResult = await requireSessionApi();
    if ("error" in authResult) return authResult.error;
    userId = authResult.session.user.id;
  }

  const timeZone = await resolveTimeZone(userId, req);
  const range = resolveStudyDayRange(searchParams, timeZone);
  if ("error" in range) {
    return NextResponse.json({ error: range.error }, { status: 400 });
  }

  const data = await getStudyStats(userId, timeZone, range);
  return NextResponse.json(data);
}
