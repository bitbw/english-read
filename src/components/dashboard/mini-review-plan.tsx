"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { padMonthGrid } from "@/lib/review-plan";
import { clientFetch } from "@/lib/client-fetch";
import { useTranslations } from "next-intl";

type DayCell = { scheduled: number; dueNow: number };
type PlanResponse = {
  year: number;
  month: number;
  todayKey: string;
  dueNowTotal: number;
  days: Record<string, DayCell>;
};

function cellDisplayCount(key: string, plan: PlanResponse): number {
  if (key > plan.todayKey) return plan.days[key]?.scheduled ?? 0;
  if (key === plan.todayKey) return plan.dueNowTotal;
  return plan.days[key]?.dueNow ?? 0;
}

export function MiniReviewPlan() {
  const t = useTranslations("plan");
  const router = useRouter();
  const now = useMemo(() => new Date(), []);
  const [year, setYear] = useState(() => now.getFullYear());
  const [month, setMonth] = useState(() => now.getMonth() + 1);
  const [plan, setPlan] = useState<PlanResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const WEEK_LABELS = t.raw("weekLabels") as string[];

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await clientFetch(
        `/api/review/plan?year=${year}&month=${month}`
      );
      if (!r.ok) return;
      const data = (await r.json()) as PlanResponse;
      setPlan(data);
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    void load();
  }, [load]);

  const dayKeys = useMemo(() => {
    const last = new Date(year, month, 0).getDate();
    const keys: string[] = [];
    for (let d = 1; d <= last; d++) {
      const dt = new Date(year, month - 1, d);
      const y = dt.getFullYear();
      const mo = String(dt.getMonth() + 1).padStart(2, "0");
      const da = String(dt.getDate()).padStart(2, "0");
      keys.push(`${y}-${mo}-${da}`);
    }
    return keys;
  }, [year, month]);

  const grid = useMemo(() => padMonthGrid(dayKeys), [dayKeys]);

  const goPrevMonth = () => {
    if (month <= 1) {
      setMonth(12);
      setYear((y) => y - 1);
    } else {
      setMonth((m) => m - 1);
    }
  };

  const goNextMonth = () => {
    if (month >= 12) {
      setMonth(1);
      setYear((y) => y + 1);
    } else {
      setMonth((m) => m + 1);
    }
  };

  const onPickDay = (key: string) => {
    if (!plan) return;
    const n = cellDisplayCount(key, plan);
    if (key > plan.todayKey) {
      router.push(`/vocabulary/review?date=${key}&preview=1`);
      return;
    }
    if (key === plan.todayKey) {
      router.push("/vocabulary/review");
      return;
    }
    if (n > 0) {
      router.push(`/vocabulary/review?date=${key}`);
    } else {
      router.push(`/vocabulary/review?date=${key}&preview=1`);
    }
  };

  return (
    <div className="rounded-xl bg-card-due/40 dark:bg-card-due/20 ring-1 ring-card-due-foreground/20 p-4 h-full transition-all duration-300 hover:shadow-lg hover:shadow-card-due-foreground/10 hover:bg-card-due/60 dark:hover:bg-card-due/30">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <Link
          href="/vocabulary/plan"
          className="flex items-center gap-1.5 text-sm font-medium text-card-due-foreground hover:underline"
        >
          <Calendar className="h-4 w-4" />
          {t("title")}
        </Link>
        <div className="flex gap-0.5">
          <button
            type="button"
            onClick={goPrevMonth}
            className="h-6 w-6 rounded flex items-center justify-center hover:bg-card-due-foreground/10 transition-colors"
            aria-label={t("prevMonth")}
          >
            <ChevronLeft className="h-3.5 w-3.5 text-card-due-foreground/70" />
          </button>
          <span className="text-xs font-medium text-card-due-foreground/70 min-w-[5rem] text-center leading-6">
            {year}/{String(month).padStart(2, "0")}
          </span>
          <button
            type="button"
            onClick={goNextMonth}
            className="h-6 w-6 rounded flex items-center justify-center hover:bg-card-due-foreground/10 transition-colors"
            aria-label={t("nextMonth")}
          >
            <ChevronRight className="h-3.5 w-3.5 text-card-due-foreground/70" />
          </button>
        </div>
      </div>

      {/* Weekday labels */}
      <div className="grid grid-cols-7 gap-0.5 text-[10px] font-medium text-card-due-foreground/50 text-center mb-1">
        {WEEK_LABELS.map((w) => (
          <div key={w} className="py-0.5">
            {w}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      {loading || !plan ? (
        <div className="grid grid-cols-7 gap-0.5 animate-pulse">
          {grid.map((_, i) => (
            <div
              key={i}
              className="aspect-square rounded bg-card-due-foreground/5"
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-0.5">
          {grid.map((key, i) => {
            if (!key) return <div key={`e-${i}`} className="aspect-square" />;
            const n = cellDisplayCount(key, plan);
            const isToday = key === plan.todayKey;
            const isFuture = key > plan.todayKey;
            const hasMark = n > 0;
            return (
              <button
                key={key}
                type="button"
                onClick={() => onPickDay(key)}
                className={cn(
                  "aspect-square rounded text-[11px] flex flex-col items-center justify-center gap-px transition-colors",
                  isToday &&
                    "bg-card-due-foreground/15 ring-1 ring-card-due-foreground/30 font-semibold text-card-due-foreground",
                  !isToday &&
                    "hover:bg-card-due-foreground/8 text-card-due-foreground/80",
                  hasMark &&
                    !isFuture &&
                    !isToday &&
                    "bg-amber-500/15",
                  isFuture && hasMark && "bg-card-due-foreground/5"
                )}
              >
                <span>{Number(key.slice(8, 10))}</span>
                {hasMark ? (
                  <span className="text-[7px] leading-none text-card-due-foreground/60">
                    {n > 99 ? "99+" : n}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      )}

      {/* Today summary */}
      {plan && (
        <div className="mt-2.5 pt-2 border-t border-card-due-foreground/10 flex items-center justify-between">
          <span className="text-xs text-card-due-foreground/60">
            {plan.dueNowTotal > 0
              ? t("todayCount", { count: plan.dueNowTotal })
              : t("allCaughtUp")}
          </span>
          <Link
            href="/vocabulary/plan"
            className="text-[11px] text-card-due-foreground/50 hover:text-card-due-foreground transition-colors"
          >
            {t("details")} →
          </Link>
        </div>
      )}
    </div>
  );
}