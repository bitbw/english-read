"use client";

import { PullToRefresh } from "@/components/pull-to-refresh";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

export function DashboardPullToRefresh({
  children,
}: {
  children: ReactNode;
}) {
  const router = useRouter();

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