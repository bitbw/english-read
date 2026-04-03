"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ReviewSession, type ReviewWord } from "@/components/review/review-session";
import { Skeleton } from "@/components/ui/skeleton";
import { BookMarked, ArrowLeft } from "lucide-react";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import {
  filterOutClearedReviews,
  getReviewScopeDay,
} from "@/lib/review-session-cache";
import { clientFetch } from "@/lib/client-fetch";

type DistractorItem = { id: string; word: string; definition: string | null };

type ReviewApiWord = ReviewWord & { nextReviewAt?: string };

type ReviewApiResponse =
  | ReviewApiWord[]
  | {
      words: ReviewApiWord[];
      pool?: DistractorItem[];
      preview?: boolean;
      date?: string | null;
    };

function buildFetchUrl(date: string | null, preview: boolean) {
  const p = new URLSearchParams();
  if (date) p.set("date", date);
  if (preview && date) p.set("preview", "1");
  const q = p.toString();
  return q ? `/api/review?${q}` : "/api/review";
}

function pageTitle(date: string | null, preview: boolean) {
  if (!date) return "今日复习";
  if (preview) return `${date} 排期`;
  return `${date} 复习`;
}

export function ReviewPageClient() {
  const searchParams = useSearchParams();
  const date = searchParams.get("date");
  const preview = searchParams.get("preview") === "1";

  const [words, setWords] = useState<ReviewApiWord[]>([]);
  const [pool, setPool] = useState<DistractorItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiPreview, setApiPreview] = useState(false);

  const fetchUrl = useMemo(() => buildFetchUrl(date, preview), [date, preview]);
  const reviewScopeDay = useMemo(() => getReviewScopeDay(date), [date]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await clientFetch(fetchUrl);
      if (!r.ok) return;
      const data = (await r.json()) as ReviewApiResponse;
      if (Array.isArray(data)) {
        const next = !preview ? filterOutClearedReviews(data, reviewScopeDay) : data;
        setWords(next);
        setPool([]);
        setApiPreview(false);
      } else {
        const isPreview = Boolean(data.preview);
        let nextWords = data.words ?? [];
        // 非「仅浏览」模式：去掉本日/本 scope 已在本地标记为已完成的词（刷新后不必重做）
        if (!isPreview && !preview) {
          nextWords = filterOutClearedReviews(nextWords, reviewScopeDay);
        }
        setWords(nextWords);
        setPool(data.pool ?? []);
        setApiPreview(isPreview);
      }
    } finally {
      setLoading(false);
    }
  }, [fetchUrl, preview, reviewScopeDay]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleReviewComplete = useCallback(() => {}, []);

  const title = pageTitle(date, preview);
  const showSession = !apiPreview && words.length > 0;
  const showPreviewList = apiPreview && words.length > 0;

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/vocabulary/plan" className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}>
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-2xl font-bold">{title}</h1>
      </div>

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-64 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
      ) : showSession ? (
        <ReviewSession
          words={words}
          distractorPool={pool}
          reviewScopeDay={reviewScopeDay}
          onComplete={handleReviewComplete}
        />
      ) : showPreviewList ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            以下为该日排期中的单词，尚未到复习时间，仅可浏览。
          </p>
          {words.map((w) => (
            <Card key={w.id} className="p-4">
              <p className="font-semibold text-lg">{w.word}</p>
              {w.phonetic && <p className="text-sm text-muted-foreground">{w.phonetic}</p>}
              {w.definition && <p className="text-sm mt-2">{w.definition}</p>}
              {w.nextReviewAt && (
                <p className="text-xs text-muted-foreground mt-2">
                  排期：{new Date(w.nextReviewAt).toISOString().slice(0, 10)} (UTC)
                </p>
              )}
            </Card>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4 py-20 text-center">
          <BookMarked className="h-14 w-14 text-muted-foreground" />
          <div>
            <p className="text-xl font-semibold">
              {!date
                ? "当前没有需要复习的单词"
                : preview
                  ? "这一天没有排期中的单词"
                  : "这一天没有已到期的复习项"}
            </p>
            <p className="text-muted-foreground mt-1">
              {!date
                ? "若刚复习完，说明今日任务已完成；也可在复习计划中查看后续排期"
                : "返回日历查看其它日期，或去阅读继续积累生词"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 justify-center">
            <Link href="/vocabulary/plan" className={cn(buttonVariants({ variant: "outline" }))}>
              复习计划
            </Link>
            <Link href="/library" className={cn(buttonVariants({ variant: "outline" }))}>
              去阅读
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
