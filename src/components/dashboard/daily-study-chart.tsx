"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { clientFetch } from "@/lib/client-fetch";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslations } from "next-intl";

type StudySeriesPoint = { day: string; readingSeconds: number; reviewSeconds: number };

function formatDayLabel(isoDay: string) {
  const m = parseInt(isoDay.slice(5, 7), 10);
  const d = parseInt(isoDay.slice(8, 10), 10);
  return `${m}/${d}`;
}

function formatBarMinutes(seconds: number) {
  const m = seconds / 60;
  if (m <= 0) return "0";
  if (m < 1) return "<1";
  return String(Math.round(m));
}

export function DailyStudyChart() {
  const t = useTranslations("chart");
  const tDash = useTranslations("dashboard");
  const [series, setSeries] = useState<StudySeriesPoint[] | null>(null);
  const [narrow, setNarrow] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await clientFetch("/api/stats/study?days=14", { showErrorToast: false });
      if (!r.ok) {
        if (!cancelled) setSeries([]);
        return;
      }
      const data = (await r.json()) as { series?: StudySeriesPoint[] };
      if (!cancelled) setSeries(data.series ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const apply = () => setNarrow(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  if (series === null) {
    return (
      <div className="space-y-4 py-2">
        <Skeleton className="h-4 w-48" />
        <div className="space-y-3">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-[72px] w-full" />
        </div>
        <div className="space-y-3">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-[72px] w-full" />
        </div>
        <Skeleton className="h-3 w-full" />
      </div>
    );
  }

  const displaySeries = narrow ? series.slice(-7) : series;
  const readingMinutes = displaySeries.map((s) => s.readingSeconds / 60);
  const reviewMinutes = displaySeries.map((s) => s.reviewSeconds / 60);
  const maxReadingMin = Math.max(...readingMinutes, 0.01);
  const maxReviewMin = Math.max(...reviewMinutes, 0.01);
  const maxBarPx = 72;

  const totalToday = series.length > 0 ? series[series.length - 1]! : null;
  const todayReadingMin = totalToday ? Math.round(totalToday.readingSeconds / 60) : 0;
  const todayReviewMin = totalToday ? Math.round(totalToday.reviewSeconds / 60) : 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-2">
        <p className="text-sm text-muted-foreground">
          {t("lastNDays", { count: displaySeries.length })}
        </p>
        <div className="flex flex-col items-end gap-0.5 sm:items-end">
          <p className="text-sm tabular-nums text-muted-foreground">
            {tDash("todayReading", { min: todayReadingMin })}
          </p>
          <p className="text-sm tabular-nums text-muted-foreground">
            {tDash("todayReviewShort", { min: todayReviewMin })}
          </p>
        </div>
      </div>

      {/* 阅读时长柱状图 */}
      <div>
        <p className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-sm bg-primary/90 dark:bg-primary/80" />
          {tDash("readingDuration")}
        </p>
        <div className="flex items-end gap-1 sm:gap-1.5 min-h-[72px] px-0.5">
          {displaySeries.map((s) => {
            const m = s.readingSeconds / 60;
            const hasTime = m > 0;
            const barPx = hasTime ? Math.max(4, (m / maxReadingMin) * maxBarPx) : 2;

            return (
              <div
                key={s.day}
                className="flex-1 min-w-0 flex flex-col items-center justify-end gap-0.5"
              >
                <span className="text-[10px] sm:text-xs font-medium tabular-nums text-foreground leading-none">
                  {formatBarMinutes(s.readingSeconds)}
                </span>
                <div
                  className={cn(
                    "w-full max-w-[28px] mx-auto rounded-md transition-[height]",
                    hasTime ? "bg-primary/90 dark:bg-primary/80" : "bg-muted"
                  )}
                  style={{ height: `${barPx}px` }}
                  title={`${tDash("readingDuration")} ${formatDayLabel(s.day)}：${t("minutes", { min: String(Math.round(m)) })}`}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* 复习时长柱状图 */}
      <div>
        <p className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-sm bg-chart-review" />
          {tDash("reviewDuration")}
        </p>
        <div className="flex items-end gap-1 sm:gap-1.5 min-h-[72px] px-0.5">
          {displaySeries.map((s) => {
            const m = s.reviewSeconds / 60;
            const hasTime = m > 0;
            const barPx = hasTime ? Math.max(4, (m / maxReviewMin) * maxBarPx) : 2;

            return (
              <div
                key={`r-${s.day}`}
                className="flex-1 min-w-0 flex flex-col items-center justify-end gap-0.5"
              >
                <span className="text-[10px] sm:text-xs font-medium tabular-nums text-foreground leading-none">
                  {formatBarMinutes(s.reviewSeconds)}
                </span>
                <div
                  className={cn(
                    "w-full max-w-[28px] mx-auto rounded-md transition-[height]",
                    hasTime ? "bg-chart-review" : "bg-muted"
                  )}
                  style={{ height: `${barPx}px` }}
                  title={`${tDash("reviewDuration")} ${formatDayLabel(s.day)}：${t("minutes", { min: String(Math.round(m)) })}`}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* 日期标签（共用一行） */}
      <div className="flex gap-1 sm:gap-1.5 px-0.5 -mt-1">
        {displaySeries.map((s) => (
          <div key={`d-${s.day}`} className="flex-1 min-w-0 flex justify-center">
            <span className="text-[10px] text-muted-foreground tabular-nums leading-none">
              {formatDayLabel(s.day)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
