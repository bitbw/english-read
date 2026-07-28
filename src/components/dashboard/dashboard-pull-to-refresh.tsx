"use client";

import { PullToRefresh } from "@/components/pull-to-refresh";
import type { ReactNode } from "react";

export function DashboardPullToRefresh({
  children,
}: {
  children: ReactNode;
}) {

  return (
    <PullToRefresh
      onRefresh={async () => {
        window.location.reload();
      }}
    >
      {children}
    </PullToRefresh>
  );
}