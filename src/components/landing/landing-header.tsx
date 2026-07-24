"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, Download } from "lucide-react";
import { buttonVariants } from "@/components/ui/button-variants";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { cn } from "@/lib/utils";
import { isCapacitor } from "@/lib/is-capacitor";

type LandingHeaderProps = {
  loginLabel: string;
};

export function LandingHeader({ loginLabel }: LandingHeaderProps) {
  // 首次渲染保持和服务端一致（false），挂载后再切换，避免 hydration mismatch
  const [inApp, setInApp] = useState(false);

  useEffect(() => {
    setInApp(isCapacitor());
  }, []);

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-bold">
          <BookOpen className="h-5 w-5 text-primary" />
          <span>English Read</span>
        </Link>
        <div className="flex items-center gap-1 sm:gap-2">
            <LocaleSwitcher />
            <ThemeToggle />
          {!inApp && (
            <Link
              href="/download"
              className={cn(
                buttonVariants({ size: "sm", variant: "outline" }),
                "gap-1.5 hidden sm:inline-flex",
              )}
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">App</span>
            </Link>
          )}
          <Link href="/login" className={cn(buttonVariants({ size: "sm" }))}>
            {loginLabel}
          </Link>
        </div>
      </div>
    </header>
  );
}
