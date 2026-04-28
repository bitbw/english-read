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
    const image =
      typeof user.image === "string" && user.image.trim()
        ? user.image.trim()
        : undefined;
    Sentry.setUser({
      id: user.id,
      email: user.email ?? undefined,
      username: user.name ?? undefined,
      // User 类型含索引签名；Issue JSON / 部分 UI 的 User 区块会带上自定义字段（非头像组件）
      ...(image ? { avatar_url: image } : {}),
      ...(user.phone ? { phone: user.phone } : {}),
    });
  } else {
    Sentry.setUser(null);
  }
}
