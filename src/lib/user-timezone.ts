import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const FALLBACK_TIME_ZONE = "UTC";

const HEADER = "x-user-timezone";

export function isValidIanaTimeZone(tz: string): boolean {
  const s = tz.trim();
  if (!s || s.length > 120) return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: s });
    return true;
  } catch {
    return false;
  }
}

/** 仅从请求头读取浏览器时区；非法或缺失返回 null */
export function timeZoneFromRequest(req: Request): string | null {
  const raw = req.headers.get(HEADER)?.trim();
  if (!raw || !isValidIanaTimeZone(raw)) return null;
  return raw;
}

/** 库中偏好 > 请求头 > UTC */
export async function resolveTimeZone(userId: string, req: Request): Promise<string> {
  const [row] = await db
    .select({ timeZone: users.timeZone })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const dbTz = row?.timeZone?.trim();
  if (dbTz && isValidIanaTimeZone(dbTz)) return dbTz;

  const headerTz = timeZoneFromRequest(req);
  if (headerTz) return headerTz;

  return FALLBACK_TIME_ZONE;
}
