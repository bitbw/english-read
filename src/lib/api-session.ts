import { auth } from "@/lib/auth";
import { touchUserOnline } from "@/lib/user-presence";
import type { Session } from "next-auth";
import { NextResponse } from "next/server";

type SessionResult =
  | { session: Session & { user: { id: string } } }
  | { error: NextResponse };

/** 鉴权 + 顺带刷新最近在线（fire-and-forget，不阻塞响应） */
export async function requireSessionApi(): Promise<SessionResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  void touchUserOnline(session.user.id);
  return { session: session as Session & { user: { id: string } } };
}
