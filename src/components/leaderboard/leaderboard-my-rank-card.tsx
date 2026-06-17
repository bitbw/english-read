"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import type { LeaderboardMetric } from "@/lib/leaderboard/constants";
import { readingSpeedTierFromWpm } from "@/lib/reading-speed-tier";
import { useTranslations } from "next-intl";

type LeaderboardMe = {
  optedIn: boolean;
  rank: number | null;
  value: number | null;
  shadowRank?: number | null;
};

type LeaderboardMyRankCardProps = {
  metric: LeaderboardMetric;
  me: LeaderboardMe | null;
};

function formatMyValue(metric: LeaderboardMetric, value: number, t: ReturnType<typeof useTranslations<"leaderboard">>, tTier: ReturnType<typeof useTranslations<"readingSpeedTier">>) {
  switch (metric) {
    case "reading_time":
    case "review_time":
    case "total_study_time":
      return t("minutesUnit", { min: Math.round(value / 60) });
    case "reading_wpm":
      return `${value} ${t("wpmUnit")} (${tTier(readingSpeedTierFromWpm(value))})`;
    case "books_completed":
      return t("booksUnit", { count: value });
    case "study_streak":
      return t("daysUnit", { count: value });
    case "study_score":
      return t("scoreUnit", { score: Math.round(value) });
    default:
      return String(value);
  }
}

export function LeaderboardMyRankCard({ metric, me }: LeaderboardMyRankCardProps) {
  const t = useTranslations("leaderboard");
  const tTier = useTranslations("readingSpeedTier");

  if (!me) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{t("myRank")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {!me.optedIn ? (
          <>
            <p className="text-muted-foreground">{t("notOptedIn")}</p>
            {me.shadowRank != null && me.value != null ? (
              <p>
                {t("shadowRankHint", {
                  rank: me.shadowRank,
                  value: formatMyValue(metric, me.value, t, tTier),
                })}
              </p>
            ) : (
              <p className="text-muted-foreground">{t("noPersonalData")}</p>
            )}
            <Link href="/settings" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "inline-flex mt-1")}>
              {t("goSettings")}
            </Link>
          </>
        ) : me.rank != null && me.value != null ? (
          <p className="text-lg font-semibold tabular-nums">
            {t("rankWithValue", {
              rank: me.rank,
              value: formatMyValue(metric, me.value, t, tTier),
            })}
          </p>
        ) : (
          <p className="text-muted-foreground">{t("noPersonalData")}</p>
        )}
      </CardContent>
    </Card>
  );
}
