import * as Sentry from "@sentry/nextjs";
import type { Session } from "next-auth";

/**
 * 将 NextAuth 会话写入 Sentry User，便于在 Issue / Replay 中识别用户。
 */
export function setSentryUserFromSession(
  session: Session | null | undefined,
): void {
  const user = session?.user;
  if (user?.id) {
    Sentry.setUser({
      id: user.id,
      email: user.email ?? undefined,
      username: user.name ?? undefined,
    });
  } else {
    Sentry.setUser(null);
  }
}
