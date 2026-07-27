"use client";

import { isCapacitor } from "@/lib/is-capacitor";
import type { ReactNode } from "react";

export function DownloadAppGuard({ children }: { children: ReactNode }) {
  if (isCapacitor()) return null;
  return <>{children}</>;
}