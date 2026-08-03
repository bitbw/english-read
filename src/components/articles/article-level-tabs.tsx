"use client";

import { useEffect } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useSearchParams } from "next/navigation";
import { fetchArticleLevel, saveArticleLevel } from "@/lib/article-level";

interface LevelTab {
  level: number;
  label: string;
}

interface ArticleLevelTabsProps {
  levelTabs: LevelTab[];
  currentLevel: number;
}

export function ArticleLevelTabs({ levelTabs, currentLevel }: ArticleLevelTabsProps) {
  const searchParams = useSearchParams();

  useEffect(() => {
    fetchArticleLevel().then((saved) => {
      if (!searchParams?.get("level") && saved !== currentLevel) {
        const url = new URL(window.location.href);
        url.searchParams.set("level", String(saved));
        window.location.replace(url.toString());
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex gap-1 rounded-lg bg-muted p-1 w-fit">
      {levelTabs.map(({ level: lv, label }) => (
        <Link
          key={lv}
          href={`/articles?level=${lv}`}
          onClick={async () => {
            await saveArticleLevel(lv);
          }}
          className={cn(
            "flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            currentLevel === lv
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          L{lv}
          <span className="hidden sm:inline text-xs opacity-60">· {label}</span>
        </Link>
      ))}
    </div>
  );
}