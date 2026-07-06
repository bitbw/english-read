"use client";

import { useEffect, useRef } from "react";
import { clientFetch } from "@/lib/client-fetch";

interface ReadingTimeTrackerOptions {
  /** Hook 是否激活 */
  enabled: boolean;
  /** 心跳间隔（毫秒），默认 30_000 */
  intervalMs?: number;
  /** 每次上报的最大秒数，默认 120 */
  maxBatchSeconds?: number;
  /** 上报前获取待刷词汇数（可选，每日阅读无此数据） */
  onWordsFlush?: () => number;
}

/**
 * 阅读活跃时长追踪 Hook。
 *
 * 页面可见时每 30s 上报一次活跃秒数到 POST /api/reading/time，
 * 页面隐藏 / 关闭时立即上报剩余时长。
 */
export function useReadingTimeTracker({
  enabled,
  intervalMs = 30_000,
  maxBatchSeconds = 120,
  onWordsFlush,
}: ReadingTimeTrackerOptions) {
  const lastMarkRef = useRef(Date.now());

  useEffect(() => {
    if (!enabled) return;

    lastMarkRef.current = Date.now();

    function postBatch(seconds: number) {
      const n = Math.round(seconds);
      if (n < 1) return;
      const capped = Math.min(maxBatchSeconds, n);
      const words = onWordsFlush?.() ?? 0;
      const body =
        words > 0
          ? JSON.stringify({ seconds: capped, words })
          : JSON.stringify({ seconds: capped });

      void clientFetch("/api/reading/time", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
        showErrorToast: false,
      }).catch(() => {});
    }

    function flush() {
      const now = Date.now();
      const elapsed = (now - lastMarkRef.current) / 1000;
      lastMarkRef.current = now;
      postBatch(Math.min(elapsed, maxBatchSeconds));
    }

    const interval = setInterval(() => {
      if (document.visibilityState === "visible") flush();
    }, intervalMs);

    function onVisibility() {
      if (document.visibilityState === "visible") {
        lastMarkRef.current = Date.now();
      } else {
        flush();
      }
    }

    function onPageHide() {
      if (document.visibilityState !== "visible") return;
      flush();
    }

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      if (document.visibilityState === "visible") flush();
    };
  }, [enabled, intervalMs, maxBatchSeconds, onWordsFlush]);
}