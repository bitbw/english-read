import { cn } from "@/lib/utils";

interface DailyStudyChartProps {
  series: { day: string; seconds: number }[];
}

function formatDayLabel(isoDay: string) {
  const m = parseInt(isoDay.slice(5, 7), 10);
  const d = parseInt(isoDay.slice(8, 10), 10);
  return `${m}/${d}`;
}

export function DailyStudyChart({ series }: DailyStudyChartProps) {
  const minutes = series.map((s) => s.seconds / 60);
  const maxMin = Math.max(...minutes, 0.01);
  const totalToday = series.length > 0 ? series[series.length - 1]!.seconds : 0;
  const todayMin = Math.round(totalToday / 60);

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm text-muted-foreground">近 {series.length} 天（按 UTC 日历）</p>
        <p className="text-sm tabular-nums text-muted-foreground">
          当前 UTC 日约 <span className="font-semibold text-foreground">{todayMin}</span> 分钟
        </p>
      </div>
      <div className="flex items-end gap-1.5 h-36 px-1">
        {series.map((s) => {
          const m = s.seconds / 60;
          const hasTime = m > 0;
          const hPct = hasTime ? Math.max(10, (m / maxMin) * 100) : 0;
          return (
            <div key={s.day} className="flex-1 min-w-0 flex flex-col items-center gap-1.5 h-full justify-end">
              <div
                className={cn(
                  "w-full max-w-[28px] mx-auto rounded-md transition-[height]",
                  hasTime ? "bg-primary/90 dark:bg-primary/80" : "bg-muted h-1"
                )}
                style={hasTime ? { height: `${hPct}%` } : undefined}
                title={`${formatDayLabel(s.day)}：${Math.round(m)} 分钟`}
              />
              <span className="text-[10px] text-muted-foreground tabular-nums leading-none">
                {formatDayLabel(s.day)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
