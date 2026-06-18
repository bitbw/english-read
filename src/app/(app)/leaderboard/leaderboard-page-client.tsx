"use client";

import { useSession } from "next-auth/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { LeaderboardBookTable, type LeaderboardBookItem } from "@/components/leaderboard/leaderboard-book-table";
import { LeaderboardMyRankCard } from "@/components/leaderboard/leaderboard-my-rank-card";
import { LeaderboardUserTable, type LeaderboardUserItem } from "@/components/leaderboard/leaderboard-user-table";
import { clientFetch } from "@/lib/client-fetch";
import {
  metricSupportsPeriod,
  type LeaderboardMetric,
  type LeaderboardPeriod,
} from "@/lib/leaderboard/constants";
import { useTranslations } from "next-intl";

type Category = "community" | "reading" | "review" | "composite";

type LeaderboardMe = {
  optedIn: boolean;
  rank: number | null;
  value: number | null;
  shadowRank?: number | null;
};

type UserLeaderboardResponse = {
  metric: LeaderboardMetric;
  period: LeaderboardPeriod | null;
  start: string | null;
  end: string | null;
  items: LeaderboardUserItem[];
  me: LeaderboardMe;
};

type PopularBooksResponse = {
  metric: "popular_books";
  items: LeaderboardBookItem[];
};

const CATEGORY_METRICS: Record<Category, LeaderboardMetric[]> = {
  community: ["popular_books"],
  reading: ["reading_time", "reading_wpm"],
  review: ["review_time"],
  composite: ["total_study_time", "study_score", "books_completed", "study_streak"],
};

type LeaderboardPageClientProps = {
  title: string;
};

export function LeaderboardPageClient({ title }: LeaderboardPageClientProps) {
  const t = useTranslations("leaderboard");
  const { data: session } = useSession();
  const currentUserId = session?.user?.id;
  const [category, setCategory] = useState<Category>("community");
  const [metric, setMetric] = useState<LeaderboardMetric>("popular_books");
  const [period, setPeriod] = useState<LeaderboardPeriod>("week");
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState<UserLeaderboardResponse | null>(null);
  const [bookData, setBookData] = useState<PopularBooksResponse | null>(null);

  const metricsInCategory = CATEGORY_METRICS[category];
  const showPeriod = metricSupportsPeriod(metric);

  useEffect(() => {
    if (!metricsInCategory.includes(metric)) {
      setMetric(metricsInCategory[0]!);
    }
  }, [category, metric, metricsInCategory]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ metric });
      if (metricSupportsPeriod(metric)) {
        params.set("period", period);
      }
      const r = await clientFetch(`/api/leaderboard?${params.toString()}`);
      if (!r.ok) {
        setUserData(null);
        setBookData(null);
        return;
      }
      const data = (await r.json()) as UserLeaderboardResponse | PopularBooksResponse;
      if (data.metric === "popular_books") {
        setBookData(data as PopularBooksResponse);
        setUserData(null);
      } else {
        setUserData(data as UserLeaderboardResponse);
        setBookData(null);
      }
    } finally {
      setLoading(false);
    }
  }, [metric, period]);

  useEffect(() => {
    void load();
  }, [load]);

  const rangeHint = useMemo(() => {
    if (!showPeriod || !userData?.start || !userData.end) return null;
    return t("rangeHint", { start: userData.start, end: userData.end });
  }, [showPeriod, t, userData?.end, userData?.start]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="text-muted-foreground mt-1 text-sm">{t("subtitle")}</p>
      </div>

      <Tabs value={category} onValueChange={(v) => setCategory(v as Category)}>
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
          <TabsTrigger value="community">{t("tabCommunity")}</TabsTrigger>
          <TabsTrigger value="reading">{t("tabReading")}</TabsTrigger>
          <TabsTrigger value="review">{t("tabReview")}</TabsTrigger>
          <TabsTrigger value="composite">{t("tabComposite")}</TabsTrigger>
        </TabsList>
      </Tabs>

      {metricsInCategory.length > 1 ? (
        <Tabs value={metric} onValueChange={(v) => setMetric(v as LeaderboardMetric)}>
          <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
            {metricsInCategory.map((m) => (
              <TabsTrigger key={m} value={m}>
                {t(`metric.${m}`)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      ) : (
        <p className="text-sm font-medium">{t(`metric.${metric}`)}</p>
      )}

      {showPeriod ? (
        <Tabs value={period} onValueChange={(v) => setPeriod(v as LeaderboardPeriod)}>
          <TabsList>
            <TabsTrigger value="week">{t("periodWeek")}</TabsTrigger>
            <TabsTrigger value="month">{t("periodMonth")}</TabsTrigger>
            <TabsTrigger value="all">{t("periodAll")}</TabsTrigger>
          </TabsList>
        </Tabs>
      ) : null}

      {rangeHint ? <p className="text-xs text-muted-foreground">{rangeHint}</p> : null}

      {metric !== "popular_books" ? (
        <LeaderboardMyRankCard metric={metric} me={userData?.me ?? null} />
      ) : null}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t(`metric.${metric}`)}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : metric === "popular_books" ? (
            <LeaderboardBookTable items={bookData?.items ?? []} />
          ) : (
            <LeaderboardUserTable
              items={userData?.items ?? []}
              metric={metric}
              currentUserId={currentUserId}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
