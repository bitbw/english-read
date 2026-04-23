"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import { padMonthGrid } from "@/lib/review-plan";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  if (key > plan.todayKey) {
    return plan.days[key]?.scheduled ?? 0;
  }
  if (key === plan.todayKey) {
    return plan.dueNowTotal;
  }
  return plan.days[key]?.dueNow ?? 0;
}

export function PlanPageClient() {
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
      const r = await clientFetch(`/api/review/plan?year=${year}&month=${month}`);
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
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/vocabulary" className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}>
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {t("subtitle")}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-lg font-semibold">{t("monthTitle", { year, month })}</CardTitle>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={goPrevMonth}
              className={cn(buttonVariants({ variant: "outline", size: "icon" }), "h-8 w-8")}
              aria-label={t("prevMonth")}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={goNextMonth}
              className={cn(buttonVariants({ variant: "outline", size: "icon" }), "h-8 w-8")}
              aria-label={t("nextMonth")}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground">
            {WEEK_LABELS.map((w) => (
              <div key={w} className="py-1">
                {w}
              </div>
            ))}
          </div>

          {loading || !plan ? (
            <div className="grid grid-cols-7 gap-1 animate-pulse">
              {grid.map((_, i) => (
                <div key={i} className="aspect-square rounded-md bg-muted" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-1">
              {grid.map((key, i) => {
                if (!key) {
                  return <div key={`e-${i}`} className="aspect-square" />;
                }
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
                      "aspect-square rounded-lg border text-sm flex flex-col items-center justify-center gap-0.5 transition-colors",
                      isToday && "border-primary ring-1 ring-primary/40 bg-primary/5",
                      !isToday && "border-border/80 hover:bg-accent/80",
                      hasMark && !isFuture && "bg-amber-500/10 border-amber-500/40",
                      isFuture && hasMark && "bg-muted/50"
                    )}
                  >
                    <span className={cn("font-medium", isToday && "text-primary")}>
                      {Number(key.slice(8, 10))}
                    </span>
                    {hasMark ? (
                      <span className="text-[10px] leading-none text-muted-foreground">{t("words", { count: n })}</span>
                    ) : (
                      <span className="text-[10px] leading-none text-transparent">.</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          <ul className="text-xs text-muted-foreground space-y-1 pt-2 border-t border-border">
            <li>{t("legendToday")}</li>
            <li>{t("legendPast")}</li>
            <li>{t("legendFuture")}</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
