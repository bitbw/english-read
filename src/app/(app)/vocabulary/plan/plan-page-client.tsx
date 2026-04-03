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

type DayCell = { scheduled: number; dueNow: number };

type PlanResponse = {
  year: number;
  month: number;
  todayKey: string;
  dueNowTotal: number;
  days: Record<string, DayCell>;
};

const WEEK_LABELS = ["一", "二", "三", "四", "五", "六", "日"];

function cellDisplayCount(key: string, plan: PlanResponse): number {
  if (key > plan.todayKey) {
    return plan.days[key]?.scheduled ?? 0;
  }
  if (key === plan.todayKey) {
    return plan.dueNowTotal;
  }
  return plan.days[key]?.dueNow ?? 0;
}

function formatMonthTitle(year: number, month: number) {
  return `${year} 年 ${month} 月`;
}

export function PlanPageClient() {
  const router = useRouter();
  const now = useMemo(() => new Date(), []);
  const [year, setYear] = useState(() => now.getUTCFullYear());
  const [month, setMonth] = useState(() => now.getUTCMonth() + 1);
  const [plan, setPlan] = useState<PlanResponse | null>(null);
  const [loading, setLoading] = useState(true);

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
    const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const keys: string[] = [];
    for (let d = 1; d <= last; d++) {
      keys.push(new Date(Date.UTC(year, month - 1, d)).toISOString().slice(0, 10));
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
          <h1 className="text-2xl font-bold">复习计划</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            按 UTC 日历日汇总，与阅读时长统计一致；今日格子数字含所有已到期（含更早拖欠）
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-lg font-semibold">{formatMonthTitle(year, month)}</CardTitle>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={goPrevMonth}
              className={cn(buttonVariants({ variant: "outline", size: "icon" }), "h-8 w-8")}
              aria-label="上一月"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={goNextMonth}
              className={cn(buttonVariants({ variant: "outline", size: "icon" }), "h-8 w-8")}
              aria-label="下一月"
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
                      <span className="text-[10px] leading-none text-muted-foreground">{n} 词</span>
                    ) : (
                      <span className="text-[10px] leading-none text-transparent">.</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          <ul className="text-xs text-muted-foreground space-y-1 pt-2 border-t border-border">
            <li>今日：显示当前所有已到期待复习数量（与首页一致）</li>
            <li>往日：该日排期且仍到期的词；点入有到期则直接开始复习</li>
            <li>未来：仅预览当日排期，尚未到期不会进入测验</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
