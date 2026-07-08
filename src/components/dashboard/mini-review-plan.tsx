"use client";

import Link from "next/link";
import { Calendar, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

interface MiniReviewPlanProps {
  dueCount: number;
}

export function MiniReviewPlan({ dueCount }: MiniReviewPlanProps) {
  const t = useTranslations("plan");

  return (
    <div className="h-full rounded-xl bg-card-due/40 dark:bg-card-due/20 ring-1 ring-card-due-foreground/20 p-4 transition-all duration-300 hover:shadow-lg hover:shadow-card-due-foreground/10 hover:bg-card-due/60 dark:hover:bg-card-due/30">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-card-due-foreground flex items-center gap-1.5">
          <Calendar className="h-4 w-4" />
          {t("title")}
        </span>
      </div>

      <p className="text-3xl font-bold text-card-due-foreground">
        {dueCount}
      </p>
      <p className="text-xs text-card-due-foreground/60 mt-1">
        {dueCount > 0
          ? t("todayCount", { count: dueCount })
          : t("allCaughtUp")}
      </p>

      <div className="mt-4 flex items-center gap-2">
        <Link
          href="/vocabulary/review"
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
            "bg-card-due-foreground/15 text-card-due-foreground hover:bg-card-due-foreground/25"
          )}
        >
          {t("startReview")}
          <ArrowRight className="h-3 w-3" />
        </Link>
        <Link
          href="/vocabulary/plan"
          className="text-[11px] text-card-due-foreground/50 hover:text-card-due-foreground transition-colors"
        >
          {t("details")}
        </Link>
      </div>
    </div>
  );
}