"use client";

import { useSession } from "next-auth/react";
import { useEffect } from "react";
import { setSentryUserFromSession } from "@/lib/sentry-user";

/** 客户端异常、Replay 等与浏览器会话关联到 Sentry User */
export function SentryUserSync() {
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status === "loading") return;
    setSentryUserFromSession(session ?? null);
  }, [session, status]);

  return null;
}
