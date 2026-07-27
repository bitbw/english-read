"use client";

import { useRef, useState, useCallback, type ReactNode } from "react";

interface PullToRefreshProps {
  children: ReactNode;
  /** default 80px — pull distance needed to trigger refresh */
  threshold?: number;
  onRefresh: () => Promise<void> | void;
}

/**
 * Lightweight pull-to-refresh wrapper for Capacitor WebView.
 * Uses touch events — no extra dependencies.
 */
export function PullToRefresh({
  children,
  threshold = 80,
  onRefresh,
}: PullToRefreshProps) {
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(0);
  const pulling = useRef(false);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    // Only activate when scrolled to top
    if (window.scrollY !== 0) return;
    startY.current = e.touches[0].clientY;
    pulling.current = true;
  }, []);

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!pulling.current || refreshing) return;
      const diff = e.touches[0].clientY - startY.current;
      if (diff <= 0) {
        setPullDistance(0);
        return;
      }
      // Add resistance (rubber-band effect)
      const distance = Math.min(diff * 0.4, 140);
      setPullDistance(distance);
    },
    [refreshing]
  );

  const handleTouchEnd = useCallback(async () => {
    if (!pulling.current) return;
    pulling.current = false;

    if (pullDistance >= threshold && !refreshing) {
      setRefreshing(true);
      setPullDistance(threshold); // hold at threshold
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
  }, [pullDistance, threshold, refreshing, onRefresh]);

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{ touchAction: "pan-x" }}
    >
      {/* Pull indicator */}
      <div
        className="flex items-center justify-center overflow-hidden transition-[height] duration-200 ease-out"
        style={{
          height: pullDistance,
        }}
      >
        <div
          className="flex items-center gap-2 text-sm text-muted-foreground"
          style={{
            opacity: Math.min(pullDistance / threshold, 1),
          }}
        >
          {refreshing ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              刷新中...
            </>
          ) : pullDistance >= threshold ? (
            "释放刷新"
          ) : (
            "下拉刷新"
          )}
        </div>
      </div>

      {children}
    </div>
  );
}