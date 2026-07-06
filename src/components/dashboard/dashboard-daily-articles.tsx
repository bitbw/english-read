"use client";

import { useState } from "react";
import Link from "next/link";
import { Newspaper, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

type ArticleItem = {
  id: string;
  title: string;
  coverUrl: string | null;
  wordCount: number | null;
  publishedAt: Date | null;
  level: number;
};

interface DashboardDailyArticlesProps {
  level1: ArticleItem[];
  level2: ArticleItem[];
  level3: ArticleItem[];
  viewAllLabel: string;
  emptyLabel: string;
  titleLabel: string;
}

const levelLabel: Record<number, string> = { 1: "L1", 2: "L2", 3: "L3" };
const levelColor: Record<number, string> = {
  1: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  2: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  3: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
};

export function DashboardDailyArticles({
  level1,
  level2,
  level3,
  viewAllLabel,
  emptyLabel,
  titleLabel,
}: DashboardDailyArticlesProps) {
  const t = useTranslations("articles");
  const levels = [
    { level: 1, articles: level1 },
    { level: 2, articles: level2 },
    { level: 3, articles: level3 },
  ];
  const [activeLevel, setActiveLevel] = useState(1);
  const currentArticles = levels.find((l) => l.level === activeLevel)?.articles ?? [];

  function formatDate(d: Date | null): string {
    if (!d) return "";
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${month}/${day}`;
  }

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Newspaper className="h-5 w-5 text-muted-foreground" />
          {titleLabel}
        </h2>
        <Link
          href="/articles"
          className="text-sm text-primary hover:underline font-medium shrink-0"
        >
          {viewAllLabel}
          <ArrowRight className="inline h-3 w-3 ml-0.5" />
        </Link>
      </div>

      {/* Level tabs */}
      <div className="flex gap-1 rounded-lg bg-muted p-1 w-fit mb-4">
        {levels.map(({ level }) => (
          <button
            key={level}
            type="button"
            data-active={activeLevel === level}
            onClick={() => setActiveLevel(level)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              activeLevel === level
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {levelLabel[level]}
            <span className="hidden sm:inline text-xs opacity-60 ml-1">
              · {t(`level${level}`)}
            </span>
          </button>
        ))}
      </div>

      {/* Articles grid */}
      {currentArticles.length > 0 ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {currentArticles.map((article) => (
            <Link
              key={article.id}
              href={`/articles/${article.id}`}
              className="group block rounded-xl overflow-hidden ring-1 ring-foreground/10 bg-card hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-ring outline-offset-2"
            >
              <div className="relative aspect-[16/9] bg-muted overflow-hidden">
                {article.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={article.coverUrl}
                    alt=""
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center bg-gradient-to-br from-primary/10 to-primary/5">
                    <Newspaper className="h-6 w-6 text-primary/30" />
                  </div>
                )}
                <span
                  className={cn(
                    "absolute top-2 left-2 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                    levelColor[article.level] ?? levelColor[1]
                  )}
                >
                  {levelLabel[article.level] ?? "L1"}
                </span>
              </div>
              <div className="p-3">
                <p className="text-sm font-medium line-clamp-2 leading-snug group-hover:text-primary transition-colors">
                  {article.title}
                </p>
                <p className="text-[11px] text-muted-foreground mt-1.5">
                  {article.wordCount
                    ? t("words", { count: article.wordCount })
                    : null}
                  {article.wordCount && article.publishedAt ? (
                    <span className="mx-1">·</span>
                  ) : null}
                  {article.publishedAt
                    ? formatDate(article.publishedAt)
                    : null}
                </p>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border py-12 text-center">
          <p className="text-sm text-muted-foreground">{emptyLabel}</p>
        </div>
      )}
    </div>
  );
}