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
import { VocabularyDefinitionView } from "@/components/vocabulary/vocabulary-definition-view";
import {
  filterOutClearedReviews,
  getReviewScopeDay,
} from "@/lib/review-session-cache";
import { clientFetch } from "@/lib/client-fetch";
import { useTranslations } from "next-intl";

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

export function ReviewPageClient() {
  const t = useTranslations("review");
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

  const title = !date
    ? t("todayTitle")
    : preview
      ? t("dateSchedule", { date })
      : t("dateReview", { date });

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
            {t("previewNote")}
          </p>
          {words.map((w) => (
            <Card key={w.id} className="p-4">
              <p className="font-semibold text-lg">{w.word}</p>
              {w.phonetic && <p className="text-sm text-muted-foreground">{w.phonetic}</p>}
              <VocabularyDefinitionView
                definition={w.definition ?? null}
                className="mt-2"
                emptyFallback={
                  w.definition ? (
                    <p className="text-sm text-muted-foreground mt-2">{w.definition}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground mt-2">{t("noDefinition")}</p>
                  )
                }
              />
              {w.nextReviewAt && (
                <p className="text-xs text-muted-foreground mt-2">
                  {t("scheduledAt", {
                    date: new Date(w.nextReviewAt).toLocaleString("zh-CN", {
                      year: "numeric",
                      month: "2-digit",
                      day: "2-digit",
                    }),
                  })}
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
                ? t("emptyTodayTitle")
                : preview
                  ? t("emptyPreviewTitle")
                  : t("emptyPastTitle")}
            </p>
            <p className="text-muted-foreground mt-1">
              {!date ? t("emptyTodayHint") : t("emptyDateHint")}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 justify-center">
            <Link href="/vocabulary/plan" className={cn(buttonVariants({ variant: "outline" }))}>
              {t("reviewPlan")}
            </Link>
            <Link href="/library" className={cn(buttonVariants({ variant: "outline" }))}>
              {t("goRead")}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
