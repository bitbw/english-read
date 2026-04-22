"use client";

import { isProductionAnalytics } from "@/lib/analytics-env";
import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";
import { useEffect } from "react";

export function PostHogProvider({
  children,
  enabled = isProductionAnalytics,
}: {
  children: React.ReactNode;
  /** 默认仅生产上报；可由父组件覆盖 */
  enabled?: boolean;
}) {
  useEffect(() => {
    if (!enabled) return;
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!key) return;
    posthog.init(key, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
      person_profiles: "identified_only",
      capture_pageview: false,
      capture_pageleave: true,
    });
  }, [enabled]);

  if (!enabled) return <>{children}</>;
  return <PHProvider client={posthog}>{children}</PHProvider>;
}
