"use client";

import { PullToRefresh } from "@/components/pull-to-refresh";
import { useRouter } from "next/navigation";
import { isCapacitor } from "@/lib/is-capacitor";
import type { ReactNode } from "react";

export function DashboardPullToRefresh({
  children,
}: {
  children: ReactNode;
}) {
  const router = useRouter();

  // Only enable pull-to-refresh in Capacitor WebView
  if (!isCapacitor()) {
    return <>{children}</>;
  }

  return (
    <PullToRefresh
      onRefresh={async () => {
        // Full page reload re-renders the Server Component with fresh data
        window.location.reload();
      }}
    >
      {children}
    </PullToRefresh>
  );
}