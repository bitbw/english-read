"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { clientFetch } from "@/lib/client-fetch";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslations } from "next-intl";

type SeriesPoint = { day: string; seconds: number };

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
  const [series, setSeries] = useState<SeriesPoint[] | null>(null);
  const [narrow, setNarrow] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await clientFetch("/api/reading/time?days=14", { showErrorToast: false });
      if (!r.ok) {
        if (!cancelled) setSeries([]);
        return;
      }
      const data = (await r.json()) as { series?: SeriesPoint[] };
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
      <div className="space-y-3 py-2">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-[118px] w-full" />
      </div>
    );
  }

  const displaySeries = narrow ? series.slice(-7) : series;
  const minutes = displaySeries.map((s) => s.seconds / 60);
  const maxMin = Math.max(...minutes, 0.01);
  const maxBarPx = 96;

  const totalToday = series.length > 0 ? series[series.length - 1]!.seconds : 0;
  const todayMin = Math.round(totalToday / 60);

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {t("lastNDays", { count: displaySeries.length })}
        </p>
        <p className="text-sm tabular-nums text-muted-foreground">
          {t("todayMinutes", { min: todayMin })}
        </p>
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex items-end gap-1 sm:gap-1.5 min-h-[118px] px-0.5">
          {displaySeries.map((s) => {
            const m = s.seconds / 60;
            const hasTime = m > 0;
            const barPx = hasTime ? Math.max(6, (m / maxMin) * maxBarPx) : 3;
            const label = formatBarMinutes(s.seconds);

            return (
              <div
                key={s.day}
                className="flex-1 min-w-0 flex flex-col items-center justify-end gap-0.5"
              >
                <span
                  className="text-[10px] sm:text-xs font-medium tabular-nums text-foreground leading-none min-h-[14px] flex items-end justify-center"
                  title={`${formatDayLabel(s.day)}：${label === "<1" ? t("lessThanOneMin") : t("minutes", { min: label })}`}
                >
                  {label}
                </span>
                <div
                  className={cn(
                    "w-full max-w-[28px] mx-auto rounded-md transition-[height]",
                    hasTime ? "bg-primary/90 dark:bg-primary/80" : "bg-muted"
                  )}
                  style={{ height: `${barPx}px` }}
                  title={`${formatDayLabel(s.day)}：${t("minutes", { min: String(Math.round(m)) })}`}
                />
              </div>
            );
          })}
        </div>
        <div className="flex gap-1 sm:gap-1.5 px-0.5">
          {displaySeries.map((s) => (
            <div key={`d-${s.day}`} className="flex-1 min-w-0 flex justify-center">
              <span className="text-[10px] text-muted-foreground tabular-nums leading-none">
                {formatDayLabel(s.day)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
