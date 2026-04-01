"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Delete, Loader2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import {
  assembledMatchesTarget,
  buildMeaningQuizFromGlosses,
  buildSpellingChunks,
  pickSimilarWords,
  resolveChineseGloss,
  shuffle,
  type MeaningQuiz,
  type QuizWord,
} from "@/lib/review-quiz";

export interface ReviewWord {
  id: string;
  word: string;
  phonetic: string | null;
  definition: string | null;
  context: string | null;
  reviewStage: number;
}

interface ReviewSessionProps {
  words: ReviewWord[];
  /** 非今日待复习的词库片段，用于近形义/拼字干扰 */
  distractorPool?: QuizWord[];
  onComplete: (results: { remembered: number; forgotten: number; requeued: number }) => void;
}

type Step = "meaning" | "spelling";

function splitContextWithHighlight(
  context: string,
  word: string
): { text: string; mark: boolean }[] {
  const w = word.trim();
  if (!w || !context) return [{ text: context, mark: false }];
  const escaped = w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(${escaped})`, "gi");
  return context.split(re).map((text) => ({
    text,
    mark: text.toLowerCase() === w.toLowerCase(),
  }));
}

function ReviewContextQuote({
  context,
  word,
  compact,
}: {
  context: string;
  word: string;
  compact?: boolean;
}) {
  const parts = splitContextWithHighlight(context, word);
  return (
    <div
      className={
        compact
          ? "rounded-md border border-border/80 bg-muted/40 px-3 py-2 text-left"
          : "rounded-lg border border-border bg-muted/30 px-3 py-3 text-left"
      }
    >
      <p className="text-[11px] font-medium text-muted-foreground mb-1.5">原文</p>
      <p
        className={
          compact
            ? "text-xs text-foreground leading-relaxed"
            : "text-sm text-foreground leading-relaxed"
        }
      >
        {parts.map((p, i) =>
          p.mark ? (
            <mark
              key={i}
              className="rounded px-0.5 bg-amber-200/90 text-foreground dark:bg-amber-500/35 dark:text-amber-50"
            >
              {p.text}
            </mark>
          ) : (
            <span key={i}>{p.text}</span>
          )
        )}
      </p>
    </div>
  );
}

export function ReviewSession({
  words,
  distractorPool = [],
  onComplete,
}: ReviewSessionProps) {
  const [queue, setQueue] = useState<ReviewWord[]>(words);
  const [failVersions, setFailVersions] = useState<Record<string, number>>({});
  const [step, setStep] = useState<Step>("meaning");
  const [spelling, setSpelling] = useState<{ available: string[]; used: string[] }>({
    available: [],
    used: [],
  });
  const [rememberedCount, setRememberedCount] = useState(0);
  const [requeuedCount, setRequeuedCount] = useState(0);
  const [finished, setFinished] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [meaningQuiz, setMeaningQuiz] = useState<MeaningQuiz | null>(null);
  const [meaningLoading, setMeaningLoading] = useState(false);
  const glossCacheRef = useRef<Map<string, string>>(new Map());
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    setQueue(words);
    setStep("meaning");
    setFinished(false);
    setRememberedCount(0);
    setRequeuedCount(0);
    setFailVersions({});
  }, [words]);

  const current = queue[0];
  /** 同一词排在队首再次失败时需重新洗牌选项，与 `current` 引用是否变化无关 */
  const quizRegenKey = current ? (failVersions[current.id] ?? 0) : 0;

  const quizBase = useMemo(() => {
    if (!current) return null;
    const others: QuizWord[] = [
      ...queue.slice(1).map((w) => ({
        id: w.id,
        word: w.word,
        definition: w.definition,
      })),
      ...distractorPool,
    ];
    const similar = pickSimilarWords(current.word, others, current.id, 8);
    const spellingChunks = buildSpellingChunks(
      current.word,
      similar.map((s) => s.word)
    );
    void quizRegenKey;
    return { similar, spellingChunks };
  }, [current, queue, distractorPool, quizRegenKey]);

  useEffect(() => {
    if (!current || !quizBase) {
      setMeaningQuiz(null);
      setMeaningLoading(false);
      return;
    }
    const { similar } = quizBase;
    let cancelled = false;
    setMeaningLoading(true);
    setMeaningQuiz(null);

    const byId = new Map<string, QuizWord>();
    byId.set(current.id, {
      id: current.id,
      word: current.word,
      definition: current.definition,
    });
    for (const s of similar) {
      byId.set(s.id, s);
    }
    const list = Array.from(byId.values());

    (async () => {
      const glossById: Record<string, string> = {};
      await Promise.all(
        list.map(async (w) => {
          const g = await resolveChineseGloss(w.word, w.definition, glossCacheRef.current);
          if (!cancelled) glossById[w.id] = g;
        })
      );
      if (cancelled) return;
      const mq = buildMeaningQuizFromGlosses(current.id, glossById, similar);
      setMeaningQuiz(mq);
      setMeaningLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [current, quizBase, quizRegenKey]);

  const bumpFailForHead = useCallback(() => {
    const head = queue[0];
    if (!head) return;
    setFailVersions((v) => ({ ...v, [head.id]: (v[head.id] ?? 0) + 1 }));
  }, [queue]);

  const moveHeadToEnd = useCallback(() => {
    setQueue((q) => {
      if (q.length <= 1) return q;
      const [head, ...rest] = q;
      return [...rest, head];
    });
    setRequeuedCount((n) => n + 1);
  }, []);

  const onMeaningWrong = useCallback(() => {
    toast.error("选错了，本题已移到本轮最后再来一遍");
    bumpFailForHead();
    if (queue.length <= 1) {
      setStep("meaning");
      return;
    }
    moveHeadToEnd();
  }, [bumpFailForHead, moveHeadToEnd, queue.length]);

  const onMeaningPick = (correct: boolean) => {
    if (!quizBase || !meaningQuiz) return;
    if (meaningQuiz.skipMeaning) {
      setSpelling({ available: shuffle(quizBase.spellingChunks), used: [] });
      setStep("spelling");
      return;
    }
    if (!correct) {
      onMeaningWrong();
      return;
    }
    setSpelling({ available: shuffle(quizBase.spellingChunks), used: [] });
    setStep("spelling");
  };

  const takeChip = (index: number) => {
    setSpelling((s) => {
      const x = s.available[index];
      if (x === undefined) return s;
      return {
        available: s.available.filter((_, j) => j !== index),
        used: [...s.used, x],
      };
    });
  };

  const undoChip = () => {
    setSpelling((s) => {
      if (s.used.length === 0) return s;
      const last = s.used[s.used.length - 1];
      return {
        used: s.used.slice(0, -1),
        available: [...s.available, last],
      };
    });
  };

  const clearSpelling = () => {
    setSpelling((s) => ({
      available: shuffle([...s.available, ...s.used]),
      used: [],
    }));
  };

  const onSpellingWrong = useCallback(() => {
    toast.error("拼写不对，本题已移到本轮最后再来一遍");
    bumpFailForHead();
    setStep("meaning");
    if (queue.length <= 1) return;
    moveHeadToEnd();
  }, [bumpFailForHead, moveHeadToEnd, queue.length]);

  const confirmSpelling = async () => {
    if (!current || !quizBase) return;
    const built = spelling.used.join("");
    if (!assembledMatchesTarget(built, current.word)) {
      onSpellingWrong();
      return;
    }

    setSubmitting(true);
    try {
      await fetch("/api/review/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vocabularyId: current.id, result: "remembered" }),
      });
    } catch {
      toast.error("提交失败，请重试");
      setSubmitting(false);
      return;
    }
    setSubmitting(false);

    setRememberedCount((c) => c + 1);

    setQueue((q) => {
      const next = q.slice(1);
      if (next.length === 0) {
        setFinished(true);
      }
      return next;
    });
    setStep("meaning");
  };

  useEffect(() => {
    if (!finished) return;
    onCompleteRef.current({
      remembered: rememberedCount,
      forgotten: 0,
      requeued: requeuedCount,
    });
  }, [finished, rememberedCount, requeuedCount]);

  if (finished) {
    return (
      <div className="flex flex-col items-center justify-center gap-6 py-12">
        <div className="text-4xl">🎉</div>
        <h2 className="text-2xl font-bold">本轮复习完成！</h2>
        <div className="flex gap-6 text-center">
          <div>
            <p className="text-3xl font-bold text-green-600">{rememberedCount}</p>
            <p className="text-sm text-muted-foreground mt-1">已记住（释义+拼写）</p>
          </div>
          {requeuedCount > 0 && (
            <div>
              <p className="text-3xl font-bold text-amber-600">{requeuedCount}</p>
              <p className="text-sm text-muted-foreground mt-1">错题重排队尾次数</p>
            </div>
          )}
        </div>
        <p className="text-muted-foreground text-sm text-center max-w-sm">
          只有中文义与拼写都正确才会记入间隔复习；答错的题会自动排到本轮末尾再练。
        </p>
      </div>
    );
  }

  if (!current || !quizBase) {
    return null;
  }

  const totalInRound = rememberedCount + queue.length;
  const progress = totalInRound > 0 ? (rememberedCount / totalInRound) * 100 : 0;

  return (
    <div className="flex flex-col items-center gap-6 max-w-lg mx-auto w-full py-6">
      <div className="w-full">
        <div className="flex justify-between text-sm text-muted-foreground mb-2">
          <span>
            已掌握 {rememberedCount} / 本轮共 {totalInRound} 词
          </span>
          <span className="text-green-600">✓ {rememberedCount}</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      <Badge variant="secondary" className="text-xs">
        第 {current.reviewStage === 0 ? "首次" : `${current.reviewStage}`} 次复习
      </Badge>

      {step === "meaning" && (
        <Card className="w-full p-6 space-y-5">
          <div className="text-center space-y-2">
            <h2 className="text-4xl font-bold tracking-tight">{current.word}</h2>
            {current.phonetic && (
              <p className="text-muted-foreground text-sm">{current.phonetic}</p>
            )}
          </div>

          {current.context ? (
            <ReviewContextQuote context={current.context} word={current.word} />
          ) : (
            <p className="text-xs text-center text-muted-foreground">暂无保存时的原文片段</p>
          )}

          {meaningLoading || !meaningQuiz ? (
            <div className="flex flex-col items-center gap-2 py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">正在加载中文释义…</p>
            </div>
          ) : meaningQuiz.skipMeaning ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground text-center">
                暂时无法取得该词的中文翻译，本轮仅考查拼写。
              </p>
              <Button className="w-full" onClick={() => onMeaningPick(true)}>
                开始拼写
              </Button>
            </div>
          ) : (
            <>
              <p className="text-sm font-medium text-center">选择正确的中文释义</p>
              <div className="grid gap-2">
                {meaningQuiz.options.map((opt, i) => (
                  <Button
                    key={`${opt.text}-${i}`}
                    variant="outline"
                    className="h-auto min-h-11 whitespace-normal py-3 px-4 text-left justify-start"
                    onClick={() => onMeaningPick(opt.correct)}
                  >
                    {opt.text}
                  </Button>
                ))}
              </div>
            </>
          )}
        </Card>
      )}

      {step === "spelling" && (
        <Card className="w-full p-6 space-y-5">
          {current.context ? (
            <ReviewContextQuote context={current.context} word={current.word} compact />
          ) : null}
          <p className="text-sm font-medium text-center">请用下方字块拼出该词（不再显示英文）</p>
          <div
            className="min-h-[3.5rem] rounded-lg border border-dashed border-muted-foreground/40 px-3 py-3 flex flex-wrap gap-2 items-center justify-center bg-muted/30"
            aria-live="polite"
          >
            {spelling.used.length === 0 ? (
              <span className="text-sm text-muted-foreground">点击下方字块组合</span>
            ) : (
              spelling.used.map((chunk, i) => (
                <span key={`${chunk}-${i}`} className="text-xl font-semibold font-mono">
                  {chunk}
                </span>
              ))
            )}
          </div>

          <div className="flex flex-wrap gap-2 justify-center">
            {spelling.available.map((chunk, i) => (
              <Button
                key={`${chunk}-${i}`}
                type="button"
                variant="secondary"
                size="sm"
                className="font-mono text-base"
                onClick={() => takeChip(i)}
              >
                {chunk}
              </Button>
            ))}
          </div>

          <div className="flex gap-2">
            <Button type="button" variant="outline" className="flex-1" onClick={undoChip}>
              <Undo2 className="h-4 w-4 mr-2" />
              撤销一步
            </Button>
            <Button type="button" variant="outline" className="flex-1" onClick={clearSpelling}>
              <Delete className="h-4 w-4 mr-2" />
              清空重选
            </Button>
          </div>

          <Button
            className="w-full bg-green-600 hover:bg-green-700 text-white"
            disabled={submitting || spelling.used.length === 0}
            onClick={() => void confirmSpelling()}
          >
            <CheckCircle2 className="h-4 w-4 mr-2" />
            {submitting ? "提交中…" : "确认拼写"}
          </Button>
        </Card>
      )}

      <p className="text-xs text-muted-foreground text-center px-2">
        近形干扰项来自你词库中拼写相近的单词；字块中含多余干扰，请选出正确组合。
      </p>
    </div>
  );
}
