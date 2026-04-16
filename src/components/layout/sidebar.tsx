"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  BookOpen,
  Library,
  BookMarked,
  LayoutDashboard,
  Settings,
  Calendar,
  ExternalLink,
} from "lucide-react";

function navItemIsActive(pathname: string, href: string) {
  if (href === "/vocabulary/plan") {
    return pathname === "/vocabulary/plan" || pathname.startsWith("/vocabulary/review");
  }
  if (href === "/library/store") return pathname.startsWith("/library/store");
  if (href === "/library") {
    return pathname === "/library" || pathname.startsWith("/library/upload");
  }
  return pathname === href;
}

const GITHUB_REPO_URL = "https://github.com/bitbw/english-read";

const navItems = [
  { href: "/dashboard", label: "首页", icon: LayoutDashboard },
  { href: "/library/store", label: "书库", icon: Library },
  { href: "/library", label: "书架", icon: BookOpen },
  { href: "/vocabulary", label: "生词本", icon: BookMarked },
  { href: "/vocabulary/plan", label: "复习计划", icon: Calendar },
  { href: "/settings", label: "设置", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex flex-col w-56 shrink-0 border-r border-border bg-card h-screen sticky top-0">
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 py-5 border-b border-border">
        <BookOpen className="h-6 w-6 text-primary" />
        <span className="font-bold text-lg">English Read</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = navItemIsActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="shrink-0 border-t border-border p-4">
        <a
          href={GITHUB_REPO_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors rounded-md outline-offset-2 focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ExternalLink className="h-4 w-4 shrink-0" aria-hidden />
          <span>GitHub 开源仓库</span>
        </a>
      </div>
    </aside>
  );
}
