"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Library,
  BookMarked,
  Calendar,
  Settings,
} from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "首页", icon: LayoutDashboard },
  { href: "/library", label: "书架", icon: Library },
  { href: "/vocabulary", label: "生词本", icon: BookMarked },
  { href: "/vocabulary/plan", label: "计划", icon: Calendar },
  { href: "/settings", label: "设置", icon: Settings },
];

export function BottomNav() {
  const pathname = usePathname();

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
