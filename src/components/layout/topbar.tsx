"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { signOut, useSession } from "next-auth/react";
import { ThemeToggle } from "./theme-toggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  LogOut,
  User,
  Menu,
  BookOpen,
  LayoutDashboard,
  Library,
  BookMarked,
  Calendar,
  Settings,
  Loader2,
  ExternalLink,
} from "lucide-react";

const GITHUB_REPO_URL = "https://github.com/bitbw/english-read";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

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

export function Topbar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [mobileNavPending, setMobileNavPending] = useState(false);
  const tNav = useTranslations("nav");
  const tTopbar = useTranslations("topbar");

  const navItems = [
    { href: "/dashboard", label: tNav("home"), icon: LayoutDashboard },
    { href: "/library/store", label: tNav("publicLibrary"), icon: Library },
    { href: "/library", label: tNav("myLibrary"), icon: BookOpen },
    { href: "/vocabulary", label: tNav("vocabulary"), icon: BookMarked },
    { href: "/vocabulary/plan", label: tNav("reviewPlan"), icon: Calendar },
    { href: "/settings", label: tNav("settings"), icon: Settings },
  ];

  useEffect(() => {
    setMobileNavPending(false);
  }, [pathname]);

  const mobileNavLoadingOverlay =
    mobileNavPending && typeof document !== "undefined"
      ? createPortal(
          <div
            className="fixed inset-0 z-[100] md:hidden flex items-center justify-center bg-background/70 backdrop-blur-sm supports-backdrop-filter:bg-background/40"
            role="status"
            aria-live="polite"
            aria-busy="true"
          >
            <Loader2 className="h-10 w-10 animate-spin text-primary" aria-hidden />
            <span className="sr-only">{tTopbar("loading")}</span>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      {mobileNavLoadingOverlay}
      <header className="h-14 border-b border-border bg-card flex items-center px-4 gap-2 shrink-0">
      {/* 移动端汉堡菜单：受控关闭，避免遮挡 main 内的 route loading */}
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetTrigger className="md:hidden p-1.5 -ml-1.5 rounded-md hover:bg-accent">
          <Menu className="h-5 w-5" />
        </SheetTrigger>
        <SheetContent side="left" showCloseButton={false} className="w-64 p-0 flex flex-col">
          <div className="flex items-center gap-2 px-4 py-5 border-b border-border shrink-0">
            <BookOpen className="h-6 w-6 text-primary" />
            <span className="font-bold text-lg">English Read</span>
          </div>
          <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
            {navItems.map(({ href, label, icon: Icon }) => {
              const isActive = navItemIsActive(pathname, href);
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => {
                    setMobileNavOpen(false);
                    if (!isActive) setMobileNavPending(true);
                  }}
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
              <span>{tNav("github")}</span>
            </a>
          </div>
        </SheetContent>
      </Sheet>

      <div className="flex-1" />

      <ThemeToggle />

      {session?.user && (
        <DropdownMenu>
          <DropdownMenuTrigger className="rounded-full focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
            <Avatar className="h-8 w-8">
              <AvatarImage
                src={session.user.image ?? ""}
                alt={session.user.name ?? ""}
              />
              <AvatarFallback>
                {session.user.name?.[0]?.toUpperCase() ?? "U"}
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <div className="flex flex-col px-2 py-1.5">
              <p className="text-sm font-medium truncate">{session.user.name}</p>
              <p className="text-xs text-muted-foreground truncate">
                {session.user.email ?? session.user.phone ?? ""}
              </p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem render={<Link href="/settings" />}>
              <User className="mr-2 h-4 w-4" />
              {tTopbar("settings")}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => signOut({ callbackUrl: "/login" })}
              variant="destructive"
            >
              <LogOut className="mr-2 h-4 w-4" />
              {tTopbar("logout")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      </header>
    </>
  );
}
