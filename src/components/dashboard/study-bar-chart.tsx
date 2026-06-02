"use client";

import { cn } from "@/lib/utils";

function formatDayLabel(isoDay: string) {
  const m = parseInt(isoDay.slice(5, 7), 10);
  const d = parseInt(isoDay.slice(8, 10), 10);
  return `${m}/${d}`;
}

function formatBarValue(seconds: number, toMinutes: boolean) {
  if (toMinutes) {
    const m = seconds / 60;
    if (m <= 0) return "0";
    if (m < 1) return "<1";
    return String(Math.round(m));
  }
  if (seconds <= 0) return "0";
  return String(seconds);
}

type StudyBarChartProps = {
  series: Array<{ day: string; value: number }>;
  /** 将 value 按分钟展示（阅读/复习时长） */
  valueAsMinutes?: boolean;
  valueLabel?: (value: number, formatted: string) => string;
  className?: string;
};

export function StudyBarChart({
  series,
  valueAsMinutes = true,
  valueLabel,
  className,
}: StudyBarChartProps) {
  if (series.length === 0) {
    return null;
  }

  const displayValues = series.map((s) =>
    valueAsMinutes ? s.value / 60 : s.value
  );
  const maxVal = Math.max(...displayValues, 0.01);
  const maxBarPx = 96;

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div className="flex items-end gap-1 sm:gap-1.5 min-h-[118px] px-0.5">
        {series.map((s, i) => {
          const display = displayValues[i] ?? 0;
          const hasValue = display > 0;
          const barPx = hasValue ? Math.max(6, (display / maxVal) * maxBarPx) : 3;
          const formatted = formatBarValue(s.value, valueAsMinutes);
          const title = valueLabel
            ? valueLabel(s.value, formatted)
            : `${formatDayLabel(s.day)}：${formatted}`;

          return (
            <div
              key={s.day}
              className="flex-1 min-w-0 flex flex-col items-center justify-end gap-0.5"
            >
              <span
                className="text-[10px] sm:text-xs font-medium tabular-nums text-foreground leading-none min-h-[14px] flex items-end justify-center"
                title={title}
              >
                {formatted}
              </span>
              <div
                className={cn(
                  "w-full max-w-[28px] mx-auto rounded-md transition-[height]",
                  hasValue ? "bg-primary/90 dark:bg-primary/80" : "bg-muted"
                )}
                style={{ height: `${barPx}px` }}
                title={title}
              />
            </div>
          );
        })}
      </div>
      <div className="flex gap-1 sm:gap-1.5 px-0.5">
        {series.map((s) => (
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
