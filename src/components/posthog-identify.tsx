"use client";

import { useSession } from "next-auth/react";
import { useEffect } from "react";
import { usePostHog } from "posthog-js/react";

/** 登录后与 PostHog Person 绑定；登出 reset（与 person_profiles: identified_only 一致） */
export function PostHogIdentify() {
  const { data: session, status } = useSession();
  const posthog = usePostHog();

  useEffect(() => {
    if (status === "loading" || !posthog) return;

    const user = session?.user;
    if (user?.id) {
      const props: Record<string, string> = {};
      if (user.email) props.email = user.email;
      if (user.name) props.name = user.name;
      if (typeof user.image === "string" && user.image.trim()) {
        props.avatar = user.image.trim();
      }
      posthog.identify(user.id, props);
    } else {
      posthog.reset();
    }
  }, [session, status, posthog]);

  return null;
}
