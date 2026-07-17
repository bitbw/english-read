"use client";

import { BackButton } from "@/components/back-button";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StudyBarChart } from "@/components/dashboard/study-bar-chart";
import { clientFetch } from "@/lib/client-fetch";
import { dayWpmFromPoint } from "@/lib/reading-wpm";
import { readingSpeedTierFromWpm } from "@/lib/reading-speed-tier";
import type { StudyStatsResponse } from "@/lib/study-stats";
import { useTranslations } from "next-intl";

type RangeMode = "7" | "14" | "30" | "custom";

function formatAvg(n: number): string {
  return n % 1 === 0 ? String(n) : n.toFixed(1);
}

function localDayKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function defaultCustomEnd(): string {
  return localDayKey();
}

function defaultCustomStart(daysBack: number): string {
  const d = new Date();
  d.setDate(d.getDate() - (daysBack - 1));
  return localDayKey(d);
}

function formatMinutes(seconds: number): number {
  return Math.round(seconds / 60);
}

export type StudyStatsPanelProps = {
  title: string;
  backHref: string;
  backLabel: string;
  statsEndpoint: string;
  subtitle?: string;
};

export function StudyStatsPanel({
  title,
  backHref,
  backLabel,
  statsEndpoint,
  subtitle,
}: StudyStatsPanelProps) {
  const t = useTranslations("stats");
  const tTier = useTranslations("readingSpeedTier");

  const [narrow, setNarrow] = useState(false);
  const [rangeMode, setRangeMode] = useState<RangeMode>("14");
  const [customDraftStart, setCustomDraftStart] = useState(() => defaultCustomStart(14));
  const [customDraftEnd, setCustomDraftEnd] = useState(defaultCustomEnd);
  const [data, setData] = useState<StudyStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [rangeError, setRangeError] = useState<string | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const apply = () => {
      const isNarrow = mq.matches;
      setNarrow(isNarrow);
      setRangeMode((prev) => {
        if (prev !== "14" && prev !== "7") return prev;
        return isNarrow ? "7" : "14";
      });
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const buildFetchUrl = useCallback(
    (mode: RangeMode, start?: string, end?: string) => {
      const base = statsEndpoint.includes("?")
        ? `${statsEndpoint}&`
        : `${statsEndpoint}?`;
      if (mode === "custom" && start && end) {
        return `${base}start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`;
      }
      return `${base}days=${mode}`;
    },
    [statsEndpoint],
  );

  const load = useCallback(
    async (mode: RangeMode, start?: string, end?: string) => {
      setLoading(true);
      setRangeError(null);
      try {
        const url = buildFetchUrl(mode, start, end);
        const r = await clientFetch(url, { showErrorToast: false });
        if (!r.ok) {
          const body = (await r.json().catch(() => null)) as { error?: string } | null;
          setRangeError(body?.error ?? t("invalidRange"));
          setData(null);
          return;
        }
        const json = (await r.json()) as StudyStatsResponse;
        setData(json);
      } finally {
        setLoading(false);
      }
    },
    [buildFetchUrl, t],
  );

  useEffect(() => {
    if (rangeMode === "custom") return;
    void load(rangeMode);
  }, [rangeMode, load]);

  const onRangeModeChange = (value: string) => {
    const mode = value as RangeMode;
    setRangeMode(mode);
    if (mode === "custom") {
      const days = narrow ? 7 : 14;
      setCustomDraftStart(defaultCustomStart(days));
      setCustomDraftEnd(defaultCustomEnd());
    }
  };

  const onCustomQuery = () => {
    if (customDraftStart > customDraftEnd) {
      setRangeError(t("invalidRange"));
      return;
    }
    void load("custom", customDraftStart, customDraftEnd);
  };

  const hasAnyData = useMemo(() => {
    if (!data) return false;
    return data.series.some(
      (s) =>
        s.readingSeconds > 0 ||
        s.reviewSeconds > 0 ||
        s.reviewedCount > 0 ||
        s.errorCount > 0 ||
        s.vocabAdded > 0,
    );
  }, [data]);

  const readingChartSeries = useMemo(
    () =>
      (data?.series ?? []).map((s) => ({
        day: s.day,
        value: s.readingSeconds,
      })),
    [data],
  );

  const reviewChartSeries = useMemo(
    () =>
      (data?.series ?? []).map((s) => ({
        day: s.day,
        value: s.reviewSeconds,
      })),
    [data],
  );

  const vocabChartSeries = useMemo(
    () =>
      (data?.series ?? []).map((s) => ({
        day: s.day,
        value: s.vocabAdded,
      })),
    [data],
  );

  return (
    <>
      <div className="flex items-center gap-3">
        <BackButton fallbackHref={backHref} label={backLabel} />
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold">{title}</h1>
          {subtitle ? (
            <p className="text-sm text-muted-foreground mt-0.5 truncate">{subtitle}</p>
          ) : null}
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <Tabs value={rangeMode} onValueChange={onRangeModeChange}>
            <TabsList className="w-full min-w-0 grid h-auto min-h-8 grid-cols-4 gap-0.5 p-0.5 group-data-horizontal/tabs:h-auto group-data-horizontal/tabs:min-h-8">
              <TabsTrigger value="7" className="min-w-0 flex-1 px-1.5 py-1.5 text-xs sm:text-sm">
                {t("range7")}
              </TabsTrigger>
              <TabsTrigger value="14" className="min-w-0 flex-1 px-1.5 py-1.5 text-xs sm:text-sm">
                {t("range14")}
              </TabsTrigger>
              <TabsTrigger value="30" className="min-w-0 flex-1 px-1.5 py-1.5 text-xs sm:text-sm">
                {t("range30")}
              </TabsTrigger>
              <TabsTrigger value="custom" className="min-w-0 flex-1 px-1.5 py-1.5 text-xs sm:text-sm">
                {t("customRange")}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent className="space-y-4">
          {rangeMode === "custom" ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
              <div className="space-y-1 flex-1 min-w-[8rem]">
                <label className="text-xs text-muted-foreground" htmlFor="stats-start">
                  {t("startDate")}
                </label>
                <Input
                  id="stats-start"
                  type="date"
                  value={customDraftStart}
                  onChange={(e) => setCustomDraftStart(e.target.value)}
                />
              </div>
              <div className="space-y-1 flex-1 min-w-[8rem]">
                <label className="text-xs text-muted-foreground" htmlFor="stats-end">
                  {t("endDate")}
                </label>
                <Input
                  id="stats-end"
                  type="date"
                  value={customDraftEnd}
                  onChange={(e) => setCustomDraftEnd(e.target.value)}
                />
              </div>
              <Button type="button" onClick={onCustomQuery} className="sm:mb-0.5">
                {t("query")}
              </Button>
            </div>
          ) : null}

          {rangeError ? (
            <p className="text-sm text-destructive">{rangeError}</p>
          ) : data ? (
            <p className="text-sm text-muted-foreground">
              {t("rangeHint", { start: data.start, end: data.end })}
            </p>
          ) : null}

          <p className="text-xs text-muted-foreground">{t("historicalHint")}</p>
        </CardContent>
      </Card>

      {loading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      ) : data ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            <Card>
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground">{t("readingTime")}</p>
                <p className="text-2xl font-bold tabular-nums mt-1">
                  {t("minutesUnit", { min: formatMinutes(data.totals.readingSeconds) })}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground">{t("avgWpm")}</p>
                <p className="text-2xl font-bold tabular-nums mt-1">
                  {data.totals.avgWpm != null ? (
                    <>
                      {data.totals.avgWpm}
                      <span className="text-xs font-normal text-muted-foreground ml-1">
                        ({tTier(readingSpeedTierFromWpm(data.totals.avgWpm))})
                      </span>
                    </>
                  ) : (
                    <span className="text-base text-muted-foreground">{t("wpmPending")}</span>
                  )}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground">{t("vocabAdded")}</p>
                <p className="text-2xl font-bold tabular-nums mt-1">
                  {data.totals.totalVocabAdded}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground">{t("avgDailyAdded")}</p>
                <p className="text-2xl font-bold tabular-nums mt-1">
                  {data.totals.avgDailyAdded}
                  <span className="text-xs font-normal text-muted-foreground ml-1">
                    {t("wordsUnit", { count: 1 }).replace(/[0-9]/g, "").trim()}
                  </span>
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground">{t("reviewedWords")}</p>
                <p className="text-2xl font-bold tabular-nums mt-1">
                  {t("wordsUnit", { count: data.totals.reviewedCount })}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground">{t("errorCount")}</p>
                <p className="text-2xl font-bold tabular-nums mt-1">
                  {t("errorsUnit", { count: data.totals.errorCount })}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground">{t("errorRate")}</p>
                <p className="text-2xl font-bold tabular-nums mt-1">
                  {data.totals.errorRate != null ? (
                    <>{t("percentUnit", { pct: formatAvg(data.totals.errorRate) })}</>
                  ) : (
                    <span className="text-base text-muted-foreground">—</span>
                  )}
                </p>
              </CardContent>
            </Card>
            <Card className="col-span-2 sm:col-span-1">
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground">{t("reviewTime")}</p>
                <p className="text-2xl font-bold tabular-nums mt-1">
                  {t("minutesUnit", { min: formatMinutes(data.totals.reviewSeconds) })}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground">{t("avgDailyReadingTime")}</p>
                <p className="text-2xl font-bold tabular-nums mt-1">
                  {t("minutesUnit", { min: formatAvg(data.totals.avgDailyReadingMins) })}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground">{t("avgDailyReviewTime")}</p>
                <p className="text-2xl font-bold tabular-nums mt-1">
                  {t("minutesUnit", { min: formatAvg(data.totals.avgDailyReviewMins) })}
                </p>
              </CardContent>
            </Card>
          </div>

          {!hasAnyData ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                {t("noData")}
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{t("readingSection")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <StudyBarChart series={readingChartSeries} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{t("vocabSection")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <StudyBarChart series={vocabChartSeries} valueAsMinutes={false} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{t("reviewSection")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <StudyBarChart series={reviewChartSeries} />

                  <div>
                    <h3 className="text-sm font-medium mb-3">{t("dailyBreakdown")}</h3>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t("colDate")}</TableHead>
                          <TableHead className="text-right">{t("colReadingMin")}</TableHead>
                          <TableHead className="text-right">{t("colWpm")}</TableHead>
                          <TableHead className="text-right">{t("colVocabAdded")}</TableHead>
                          <TableHead className="text-right">{t("colReviewed")}</TableHead>
                          <TableHead className="text-right">{t("colErrors")}</TableHead>
                          <TableHead className="text-right">{t("colErrorRate")}</TableHead>
                          <TableHead className="text-right">{t("colReviewMin")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {[...data.series].reverse().map((row) => {
                          const wpm = dayWpmFromPoint(row.readingWords, row.readingSeconds);
                          return (
                            <TableRow key={row.day}>
                              <TableCell className="tabular-nums">{row.day}</TableCell>
                              <TableCell className="text-right tabular-nums">
                                {formatMinutes(row.readingSeconds)}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {wpm ?? "—"}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {row.vocabAdded}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {row.reviewedCount}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {row.errorCount}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {row.errorRate != null ? `${row.errorRate}%` : "—"}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {formatMinutes(row.reviewSeconds)}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </>
      ) : null}
    </>
  );
}
