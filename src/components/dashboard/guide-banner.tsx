"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, BookOpenCheck, X } from "lucide-react";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

const GUIDE_BANNER_DISMISSED_KEY = "bowen_guide_banner_dismissed";

type GuideBannerProps = {
  isNewUser: boolean;
};

export function GuideBanner({ isNewUser }: GuideBannerProps) {
  const t = useTranslations("dashboard");
  const [dismissed, setDismissed] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const val = localStorage.getItem(GUIDE_BANNER_DISMISSED_KEY);
      setDismissed(val === "true");
    } catch {
      /* ignore */
    }
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(GUIDE_BANNER_DISMISSED_KEY, "true");
    } catch {
      /* ignore */
    }
  };

  if (!mounted) return null;
  if (dismissed && !isNewUser) return null;

  return (
    <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-primary/5 via-primary/5 to-primary/10 ring-1 ring-primary/20 p-5">
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/3 pointer-events-none" />
      <button
        type="button"
        onClick={handleDismiss}
        className="absolute top-3 right-3 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        aria-label={t("guideBannerDismiss")}
      >
        <X className="h-4 w-4" />
      </button>
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 ring-1 ring-primary/20">
            <BookOpenCheck className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="font-semibold text-foreground">
              {t("guideBannerTitle")}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {t("guideBannerDesc")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
          <Link
            href="/guide"
            className={cn(buttonVariants(), "shrink-0")}
          >
            {t("guideBannerCta")}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
          {isNewUser ? (
            <button
              type="button"
              onClick={handleDismiss}
              className={cn(
                buttonVariants({ variant: "ghost", size: "sm" }),
                "text-xs text-muted-foreground shrink-0"
              )}
            >
              {t("guideBannerDismiss")}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}