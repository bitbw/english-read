"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import {
  LayoutDashboard,
  Library,
  BookMarked,
  Calendar,
  Settings,
} from "lucide-react";

export function BottomNav() {
  const pathname = usePathname();
  const t = useTranslations("nav");

  const navItems = [
    { href: "/dashboard", label: t("home"), icon: LayoutDashboard },
    { href: "/library", label: t("myLibrary"), icon: Library },
    { href: "/vocabulary", label: t("vocabulary"), icon: BookMarked },
    { href: "/vocabulary/plan", label: t("reviewPlan"), icon: Calendar },
    { href: "/settings", label: t("settings"), icon: Settings },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border flex items-stretch h-16 safe-area-inset-bottom">
      {navItems.map(({ href, label, icon: Icon }) => {
        const isActive =
          href === "/dashboard"
            ? pathname === "/dashboard"
            : href === "/vocabulary/plan"
              ? pathname === "/vocabulary/plan" || pathname.startsWith("/vocabulary/review")
              : href === "/vocabulary"
                ? pathname === "/vocabulary"
                : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors",
              isActive
                ? "text-primary"
                : "text-muted-foreground"
            )}
          >
            <Icon className={cn("h-5 w-5", isActive && "stroke-[2.5]")} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
