"use client";

import Link from "next/link";
import { BookOpen } from "lucide-react";
import { buttonVariants } from "@/components/ui/button-variants";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { cn } from "@/lib/utils";

type LandingHeaderProps = {
  loginLabel: string;
};

export function LandingHeader({ loginLabel }: LandingHeaderProps) {
  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-bold">
          <BookOpen className="h-5 w-5 text-primary" />
          <span>English Read</span>
        </Link>
        <div className="flex items-center gap-2">
          <LocaleSwitcher />
          <ThemeToggle />
          <Link href="/login" className={cn(buttonVariants({ size: "sm" }))}>
            {loginLabel}
          </Link>
        </div>
      </div>
    </header>
  );
}
