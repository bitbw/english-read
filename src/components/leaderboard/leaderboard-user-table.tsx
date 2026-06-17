"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { readingSpeedTierFromWpm } from "@/lib/reading-speed-tier";
import type { LeaderboardMetric } from "@/lib/leaderboard/constants";
import { useTranslations } from "next-intl";

export type LeaderboardUserItem = {
  rank: number;
  userId: string;
  name: string | null;
  image: string | null;
  value: number;
};

type LeaderboardUserTableProps = {
  items: LeaderboardUserItem[];
  metric: LeaderboardMetric;
  currentUserId?: string;
};

function displayName(name: string | null, fallback: string) {
  const trimmed = name?.trim();
  return trimmed ? trimmed : fallback;
}

function formatUserValue(metric: LeaderboardMetric, value: number, t: ReturnType<typeof useTranslations<"leaderboard">>, tTier: ReturnType<typeof useTranslations<"readingSpeedTier">>) {
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

export function LeaderboardUserTable({ items, metric, currentUserId }: LeaderboardUserTableProps) {
  const t = useTranslations("leaderboard");
  const tTier = useTranslations("readingSpeedTier");

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground py-8 text-center">{t("empty")}</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-14">{t("colRank")}</TableHead>
          <TableHead>{t("colUser")}</TableHead>
          <TableHead className="text-right">{t("colValue")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => {
          const isMe = currentUserId != null && item.userId === currentUserId;
          return (
            <TableRow key={item.userId} className={isMe ? "bg-primary/5" : undefined}>
              <TableCell className="font-medium tabular-nums">{item.rank}</TableCell>
              <TableCell>
                <div className="flex items-center gap-2 min-w-0">
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarImage src={item.image ?? ""} />
                    <AvatarFallback>
                      {(displayName(item.name, t("anonymous"))[0] ?? "?").toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="truncate">
                    {displayName(item.name, t("anonymous"))}
                    {isMe ? (
                      <span className="ml-1 text-xs text-muted-foreground">({t("you")})</span>
                    ) : null}
                  </span>
                </div>
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatUserValue(metric, item.value, t, tTier)}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
