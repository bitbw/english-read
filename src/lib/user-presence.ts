import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { and, eq, isNull, lt, or } from "drizzle-orm";

const THROTTLE_MS = 5 * 60 * 1000;

/** 更新最近在线时间；DB 侧节流：距上次不足 5 分钟则跳过写入 */
export async function touchUserOnline(userId: string): Promise<void> {
  const cutoff = new Date(Date.now() - THROTTLE_MS);
  await db
    .update(users)
    .set({ lastOnlineAt: new Date() })
    .where(
      and(
        eq(users.id, userId),
        or(isNull(users.lastOnlineAt), lt(users.lastOnlineAt, cutoff)),
      ),
    );
}
