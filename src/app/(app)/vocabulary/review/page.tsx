"use client";

import { useEffect, useState } from "react";
import { ReviewSession } from "@/components/review/review-session";
import { Skeleton } from "@/components/ui/skeleton";
import { BookMarked, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

interface ReviewWord {
  id: string;
  word: string;
  phonetic: string | null;
  definition: string | null;
  context: string | null;
  reviewStage: number;
}

export default function ReviewPage() {
  const [words, setWords] = useState<ReviewWord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/review")
      .then((r) => r.json())
      .then((data) => setWords(data))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/vocabulary" className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}>
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-2xl font-bold">今日复习</h1>
      </div>

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-64 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
      ) : words.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-20 text-center">
          <BookMarked className="h-14 w-14 text-muted-foreground" />
          <div>
            <p className="text-xl font-semibold">今天没有需要复习的单词</p>
            <p className="text-muted-foreground mt-1">继续阅读收集更多单词，或明天再来复习</p>
          </div>
          <Link href="/library" className={cn(buttonVariants({ variant: "outline" }))}>
            去阅读
          </Link>
        </div>
      ) : (
        <ReviewSession words={words} onComplete={() => {}} />
      )}
    </div>
  );
}
