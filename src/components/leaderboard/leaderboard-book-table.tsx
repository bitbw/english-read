"use client";

import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useTranslations } from "next-intl";

export type LeaderboardBookItem = {
  rank: number;
  publicBookId: string;
  title: string;
  author: string | null;
  coverUrl: string | null;
  tier: string;
  shelfCount: number;
};

type LeaderboardBookTableProps = {
  items: LeaderboardBookItem[];
};

export function LeaderboardBookTable({ items }: LeaderboardBookTableProps) {
  const t = useTranslations("leaderboard");
  const tLibrary = useTranslations("library");

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground py-8 text-center">{t("empty")}</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-14">{t("colRank")}</TableHead>
          <TableHead>{t("colBook")}</TableHead>
          <TableHead className="text-right">{t("colShelfCount")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <TableRow key={item.publicBookId}>
            <TableCell className="font-medium tabular-nums">{item.rank}</TableCell>
            <TableCell>
              <Link
                href={`/library/store/${item.publicBookId}`}
                className="flex items-center gap-3 min-w-0 hover:underline underline-offset-4"
              >
                {item.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- blob CDN cover
                  <img
                    src={item.coverUrl}
                    alt=""
                    className="h-12 w-9 shrink-0 rounded object-cover bg-muted"
                  />
                ) : (
                  <div className="h-12 w-9 shrink-0 rounded bg-muted" aria-hidden />
                )}
                <span className="min-w-0">
                  <span className="block font-medium truncate">{item.title}</span>
                  {item.author ? (
                    <span className="block text-xs text-muted-foreground truncate">{item.author}</span>
                  ) : null}
                  <span className="block text-[11px] text-primary mt-0.5">
                    {tLibrary(`readingTier.${item.tier}`)}
                  </span>
                </span>
              </Link>
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {t("shelfCountUnit", { count: item.shelfCount })}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
