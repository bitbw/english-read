"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Delete, Lightbulb, Loader2, Undo2, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  assembledMatchesTarget,
  buildMeaningQuizEnriched,
  buildSpellingTray,
  isPhraseSpellingTarget,
  looksLikeChinese,
  normalizeWordKey,
  pickDistractorEnglishWords,
  pickSimilarWords,
  resolveChineseGloss,
  shuffle,
  storedChineseGloss,
  type MeaningQuiz,
  type QuizWord,
} from "@/lib/review-quiz";
import { markReviewClearedForScope } from "@/lib/review-session-cache";
import { clientFetch } from "@/lib/client-fetch";
import { linkifyToReactNodes } from "@/components/linkified-text";
import {
  playPronunciationMp3,
  stopPronunciationAudio,
} from "@/lib/pronunciation-audio";

export interface ReviewWord {
  id: string;
  word: string;
  phonetic: string | null;
  definition: string | null;
  context: string | null;
  reviewStage: number;
  /** 词典 CDN mp3，可能为空 */
  audioUk?: string | null;
  audioUs?: string | null;
}

interface ReviewSessionProps {
  words: ReviewWord[];
  /** 非今日待复习的词库片段，用于近形义/拼字干扰 */
  distractorPool?: QuizWord[];
  /** 与复习页一致：URL `date` 或本地今日，用于本地缓存「本 scope 已过关」 */
  reviewScopeDay: string;
  onComplete: (results: { remembered: number; forgotten: number; requeued: number }) => void;
}

type Step = "meaning" | "spelling";

/** 拼字托盘：rankById 固定格子顺序；已选 id 记入 usedIds，格子上仍显示但禁用 */
type SpellingTrayState = {
  labels: string[];
  rankById: number[];
  usedIds: number[];
};

function initSpellingTray(labels: string[]): SpellingTrayState {
  const n = labels.length;
  if (n === 0) {
    return { labels: [], rankById: [], usedIds: [] };
  }
  const ids = Array.from({ length: n }, (_, i) => i);
  const multi: number[] = [];
  const single: number[] = [];
  for (const id of ids) {
    const len = (labels[id] ?? "").length;
    if (len > 1) multi.push(id);
    else single.push(id);
  }
  /** 分块/单词在上，单字母在下；组内仍随机，避免固定位置背答案 */
  const ordered = [...shuffle(multi), ...shuffle(single)];
  const rankById = new Array<number>(n);
  ordered.forEach((id, idx) => {
    rankById[id] = idx;
  });
  return { labels, rankById, usedIds: [] };
}

/** 单词双区：先洗牌字块区索引，再洗牌字母区索引，保证字块整体排在字母区之上 */
function initSpellingTrayWithSplit(labels: string[], chunkCount: number): SpellingTrayState {
  const n = labels.length;
  if (n === 0) return { labels: [], rankById: [], usedIds: [] };
  const cc = Math.min(Math.max(0, chunkCount), n);
  if (cc === 0 || cc >= n) return initSpellingTray(labels);
  const chunkIds = Array.from({ length: cc }, (_, i) => i);
  const letterIds = Array.from({ length: n - cc }, (_, i) => i + cc);
  const ordered = [...shuffle(chunkIds), ...shuffle(letterIds)];
  const rankById = new Array<number>(n);
  ordered.forEach((id, idx) => {
    rankById[id] = idx;
  });
  return { labels, rankById, usedIds: [] };
}

function preferredPronunciationUrl(w: ReviewWord): string {
  const us = w.audioUs?.trim();
  const uk = w.audioUk?.trim();
  return us || uk || "";
}

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
            <span key={i}>{linkifyToReactNodes(p.text)}</span>
          )
        )}
      </p>
    </div>
  );
}

/** 与「手动添加生词」弹层一致：双 mp3 为「美」「英」；仅一条 mp3 为扬声器图标；无 mp3 时 TTS；词组不展示 */
function ReviewPronunciationControls({
  word,
  audioUsTrim,
  audioUkTrim,
  phrase,
}: {
  word: string;
  audioUsTrim: string;
  audioUkTrim: string;
  phrase: boolean;
}) {
  const w = word.trim();
  const speakTts = useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(w);
    utterance.lang = "en-US";
    window.speechSynthesis.speak(utterance);
  }, [w]);

  const playMp3 = useCallback(
    (url: string) => {
      playPronunciationMp3(url, speakTts);
    },
    [speakTts]
  );

  if (phrase || !w) return null;

  if (audioUsTrim && audioUkTrim) {
    return (
      <span className="inline-flex shrink-0 items-center gap-0.5">
        <button
          type="button"
          onClick={() => playMp3(audioUsTrim)}
          className="text-muted-foreground hover:text-foreground px-1 py-0.5 rounded text-xs font-medium"
          title="美音"
        >
          美
        </button>
        <button
          type="button"
          onClick={() => playMp3(audioUkTrim)}
          className="text-muted-foreground hover:text-foreground px-1 py-0.5 rounded text-xs font-medium"
          title="英音"
        >
          英
        </button>
      </span>
    );
  }
  if (audioUsTrim || audioUkTrim) {
    const url = audioUsTrim || audioUkTrim;
    const title = audioUsTrim ? "美音" : "英音";
    return (
      <button
        type="button"
        onClick={() => playMp3(url)}
        className="text-muted-foreground hover:text-foreground p-0.5 rounded"
        title={title}
      >
        <Volume2 className="h-3.5 w-3.5" />
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={speakTts}
      className="text-muted-foreground hover:text-foreground p-0.5 rounded"
      title="发音（语音合成）"
    >
      <Volume2 className="h-3.5 w-3.5" />
    </button>
  );
}

export function ReviewSession({
  words,
  distractorPool = [],
  reviewScopeDay,
  onComplete,
}: ReviewSessionProps) {
  const [queue, setQueue] = useState<ReviewWord[]>(words);
  const [failVersions, setFailVersions] = useState<Record<string, number>>({});
  const [step, setStep] = useState<Step>("meaning");
  const [spelling, setSpelling] = useState<SpellingTrayState>(() =>
    initSpellingTray([])
  );
  /** 拼写与目标不一致：红框提示，修改拼写后清除 */
  const [spellingAssemblyError, setSpellingAssemblyError] = useState(false);
  const [spellingShakePlay, setSpellingShakePlay] = useState(false);
  const spellingShakeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [spellHintLevel, setSpellHintLevel] = useState(0);
  /** 手动键盘输入；与点选字块二选一展示逻辑：有输入时以输入为准参与提交 */
  const [manualSpelling, setManualSpelling] = useState("");
  const [spellGlossDisplay, setSpellGlossDisplay] = useState("");
  const [rememberedCount, setRememberedCount] = useState(0);
  const [requeuedCount, setRequeuedCount] = useState(0);
  const [finished, setFinished] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [meaningQuiz, setMeaningQuiz] = useState<MeaningQuiz | null>(null);
  const [meaningLoading, setMeaningLoading] = useState(false);
  const [meaningPhase, setMeaningPhase] = useState<"pick" | "revealed">("pick");
  const [pickMeta, setPickMeta] = useState<{ index: number; correct: boolean } | null>(null);
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
    setSpellingAssemblyError(false);
    setSpellingShakePlay(false);
    if (spellingShakeTimerRef.current) {
      clearTimeout(spellingShakeTimerRef.current);
      spellingShakeTimerRef.current = null;
    }
  }, [words]);

  const current = queue[0];

  /** 布局里滚动的是 `main` 而非 window；拼写区较高时用户会滚到下方，切题后需回到顶部才能看到新词的标题 */
  useLayoutEffect(() => {
    const main = document.querySelector("main");
    if (main) main.scrollTop = 0;
  }, [current?.id]);

  /** 释义题展示单词时自动播放（优先美音）；切题或离开本步时停止 */
  useEffect(() => {
    if (step !== "meaning" || !current) return;
    const url = preferredPronunciationUrl(current);
    if (!url) return;
    const t = window.setTimeout(() => {
      playPronunciationMp3(url);
    }, 120);
    return () => {
      clearTimeout(t);
      stopPronunciationAudio();
    };
  }, [current, step]);

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
    const spellingTray = buildSpellingTray(current.word, similar.map((s) => s.word));
    void quizRegenKey;
    return { similar, spellingTray };
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
    setMeaningPhase("pick");
    setPickMeta(null);

    (async () => {
      let preload: { word: string; explainZh: string }[] = [];
      try {
        const r = await clientFetch(
          `/api/review/similar-words?word=${encodeURIComponent(current.word.trim())}`,
          { showErrorToast: false }
        );
        if (r.ok) {
          const j = (await r.json()) as { distractors?: { word: string; explainZh: string }[] };
          preload = Array.isArray(j.distractors) ? j.distractors : [];
        }
      } catch {
        /* ignore */
      }
      if (cancelled) return;

      const preloadKeys = new Set(preload.map((p) => normalizeWordKey(p.word)));
      const distractorEn = pickDistractorEnglishWords(current.word, [], similar, 10).filter(
        (w) => !preloadKeys.has(normalizeWordKey(w))
      );
      const mq = await buildMeaningQuizEnriched({
        currentId: current.id,
        currentWord: current.word,
        currentDefinition: current.definition,
        distractorPreload: preload.map((p) => ({
          word: p.word.trim(),
          zh: p.explainZh.trim(),
        })),
        distractorEnglish: distractorEn,
        glossCache: glossCacheRef.current,
      });
      if (cancelled) return;
      setMeaningQuiz(mq);
      setMeaningLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [current, quizBase, quizRegenKey]);

  useEffect(() => {
    if (step !== "spelling" || !current) {
      setSpellGlossDisplay("");
      return;
    }
    const sync = storedChineseGloss(current.definition);
    if (sync && looksLikeChinese(sync)) setSpellGlossDisplay(sync);
    else setSpellGlossDisplay("");
    let cancelled = false;
    void (async () => {
      const zh = (
        await resolveChineseGloss(current.word, current.definition, glossCacheRef.current)
      ).trim();
      if (cancelled) return;
      if (zh && looksLikeChinese(zh)) setSpellGlossDisplay(zh);
      else if (sync && looksLikeChinese(sync)) setSpellGlossDisplay(sync);
      else setSpellGlossDisplay(zh || "暂无中文释义");
    })();
    return () => {
      cancelled = true;
    };
  }, [step, current, current?.id, current?.word, current?.definition]);

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

  const clearSpellingAssemblyError = useCallback(() => {
    setSpellingAssemblyError(false);
    setSpellingShakePlay(false);
    if (spellingShakeTimerRef.current) {
      clearTimeout(spellingShakeTimerRef.current);
      spellingShakeTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (spellingShakeTimerRef.current) clearTimeout(spellingShakeTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (step !== "spelling") {
      clearSpellingAssemblyError();
      setManualSpelling("");
    }
  }, [step, clearSpellingAssemblyError]);

  const proceedAfterMeaningReveal = () => {
    if (!quizBase || !meaningQuiz || !pickMeta) return;
    if (pickMeta.correct) {
      clearSpellingAssemblyError();
      setSpelling(
        quizBase.spellingTray.chunkCount > 0
          ? initSpellingTrayWithSplit(quizBase.spellingTray.labels, quizBase.spellingTray.chunkCount)
          : initSpellingTray(quizBase.spellingTray.labels)
      );
      setSpellHintLevel(0);
      setSpellGlossDisplay("");
      setManualSpelling("");
      setStep("spelling");
    } else {
      onMeaningWrong();
    }
    setMeaningPhase("pick");
    setPickMeta(null);
  };

  const onMeaningOptionClick = (index: number, correct: boolean) => {
    if (!meaningQuiz || meaningQuiz.skipMeaning || meaningPhase !== "pick") return;
    setPickMeta({ index, correct });
    setMeaningPhase("revealed");
  };

  const onSkipMeaningToSpelling = () => {
    if (!quizBase || !meaningQuiz) return;
    clearSpellingAssemblyError();
    setSpelling(
      quizBase.spellingTray.chunkCount > 0
        ? initSpellingTrayWithSplit(quizBase.spellingTray.labels, quizBase.spellingTray.chunkCount)
        : initSpellingTray(quizBase.spellingTray.labels)
    );
    setSpellHintLevel(0);
    setSpellGlossDisplay("");
    setManualSpelling("");
    setStep("spelling");
  };

  const takeChip = (id: number) => {
    clearSpellingAssemblyError();
    setManualSpelling("");
    setSpelling((s) => {
      if (s.usedIds.includes(id)) return s;
      return { ...s, usedIds: [...s.usedIds, id] };
    });
  };

  const undoChip = () => {
    clearSpellingAssemblyError();
    setSpelling((s) => {
      if (s.usedIds.length === 0) return s;
      return { ...s, usedIds: s.usedIds.slice(0, -1) };
    });
  };

  const clearSpelling = () => {
    clearSpellingAssemblyError();
    setManualSpelling("");
    setSpelling((s) => ({ ...s, usedIds: [] }));
  };

  const onManualSpellingChange = (value: string) => {
    clearSpellingAssemblyError();
    setManualSpelling(value);
    if (value.trim().length > 0) {
      setSpelling((s) => (s.usedIds.length === 0 ? s : { ...s, usedIds: [] }));
    }
  };

  const confirmSpelling = async () => {
    if (!current || !quizBase) return;
    const manual = manualSpelling.trim();
    const built =
      manual.length > 0 ? manual : spelling.usedIds.map((id) => spelling.labels[id] ?? "").join("");
    if (!assembledMatchesTarget(built, current.word)) {
      if (spellingShakeTimerRef.current) clearTimeout(spellingShakeTimerRef.current);
      setSpellingAssemblyError(true);
      setSpellingShakePlay(true);
      spellingShakeTimerRef.current = setTimeout(() => {
        setSpellingShakePlay(false);
        spellingShakeTimerRef.current = null;
      }, 450);
      toast.error("拼写不正确，请修改后再提交");
      return;
    }

    clearSpellingAssemblyError();
    setSubmitting(true);
    try {
      const res = await clientFetch("/api/review/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vocabularyId: current.id, result: "remembered" }),
      });
      if (!res.ok) {
        setSubmitting(false);
        return;
      }
    } catch {
      // 网络错误已由 clientFetch 提示
      setSubmitting(false);
      return;
    }
    setSubmitting(false);

    markReviewClearedForScope(reviewScopeDay, current.id);

    setRememberedCount((c) => c + 1);

    setQueue((q) => {
      const next = q.slice(1);
      if (next.length === 0) {
        setFinished(true);
      }
      return next;
    });
    setManualSpelling("");
    setSpelling((s) => ({ ...s, usedIds: [] }));
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
          只有中文义与拼写都正确才会记入间隔复习；答错的题会自动排到本轮末尾再练。已过关的词会记在本地，刷新页面当天不必重做。
        </p>
      </div>
    );
  }

  if (!current || !quizBase) {
    return null;
  }

  const totalInRound = rememberedCount + queue.length;
  const progress = totalInRound > 0 ? (rememberedCount / totalInRound) * 100 : 0;
  const phraseSpelling = current ? isPhraseSpellingTarget(current.word) : false;
  /** 单词：字块区在 labels 前段的长度；词组为 0 */
  const spellingChunkCount = phraseSpelling ? 0 : quizBase.spellingTray.chunkCount;
  const spellKeyNorm = current ? normalizeWordKey(current.word) : "";
  const spellHintShown =
    spellHintLevel >= 2
      ? current.word.trim()
      : spellHintLevel === 1 && spellKeyNorm.length > 0
        ? (() => {
            const k = Math.max(1, Math.floor(spellKeyNorm.length * 0.35));
            return `${spellKeyNorm.slice(0, k)}${"·".repeat(spellKeyNorm.length - k)}`;
          })()
        : null;

  const spellingSlotOrder =
    spelling.labels.length === 0
      ? []
      : Array.from({ length: spelling.labels.length }, (_, i) => i).sort(
          (a, b) => (spelling.rankById[a] ?? 0) - (spelling.rankById[b] ?? 0)
        );
  const spellingUsedSet = new Set(spelling.usedIds);
  const audioUsTrim = current.audioUs?.trim() ?? "";
  const audioUkTrim = current.audioUk?.trim() ?? "";

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
            <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
              {current.phonetic ? (
                <p className="text-muted-foreground text-sm">{current.phonetic}</p>
              ) : null}
              <ReviewPronunciationControls
                word={current.word}
                audioUsTrim={audioUsTrim}
                audioUkTrim={audioUkTrim}
                phrase={phraseSpelling}
              />
            </div>
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
              <Button className="w-full" onClick={onSkipMeaningToSpelling}>
                开始拼写
              </Button>
            </div>
          ) : (
            <>
              <p className="text-sm font-medium text-center">
                {meaningPhase === "pick"
                  ? "选择正确的中文释义（翻面后可见英文）"
                  : "翻面：对应英文"}
              </p>
              <div className="grid gap-3">
                {meaningQuiz.options.map((opt, i) => {
                  const flipped = meaningPhase === "revealed";
                  const isSelected = pickMeta?.index === i;
                  const backHighlight = flipped
                    ? opt.correct
                      ? "border-green-600/70 bg-green-500/10"
                      : isSelected
                        ? "border-destructive/80 bg-destructive/10"
                        : "border-border"
                    : "border-border";

                  return (
                    <div key={opt.key} className="w-full" style={{ perspective: "1000px" }}>
                      <button
                        type="button"
                        aria-disabled={flipped}
                        tabIndex={flipped ? -1 : 0}
                        onClick={() => onMeaningOptionClick(i, opt.correct)}
                        onKeyDown={(e) => {
                          if (!flipped) return;
                          if (e.key === "Enter" || e.key === " ") e.preventDefault();
                        }}
                        className={cn(
                          "relative w-full text-left outline-none rounded-xl",
                          meaningPhase === "pick" &&
                            "cursor-pointer focus-visible:ring-2 focus-visible:ring-ring",
                          flipped && "cursor-text"
                        )}
                      >
                        <div
                          className={cn(
                            "relative min-h-[132px] w-full transition-transform duration-500 [transform-style:preserve-3d]",
                            flipped && "[transform:rotateY(180deg)]"
                          )}
                        >
                          {/* 正面：仅中文释义 */}
                          <div
                            className={cn(
                              "absolute inset-0 flex flex-col justify-center rounded-xl border bg-card p-4 shadow-sm [backface-visibility:hidden]",
                              "border-border"
                            )}
                          >
                            <p className="text-base font-medium text-foreground leading-snug">
                              {opt.primaryZh}
                            </p>
                          </div>
                          {/* 背面：仅英文 */}
                          <div
                            className={cn(
                              "absolute inset-0 flex flex-col justify-center rounded-xl border bg-muted/40 p-4 shadow-sm [backface-visibility:hidden] [transform:rotateY(180deg)] select-text",
                              backHighlight
                            )}
                          >
                            <p className="text-xl font-bold tracking-tight text-foreground text-center">
                              {opt.english ?? "—"}
                            </p>
                            {!opt.english ? (
                              <p className="text-xs text-muted-foreground text-center mt-2">
                                此为占位干扰项
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </button>
                    </div>
                  );
                })}
              </div>
              {meaningPhase === "revealed" && pickMeta && (
                <div className="space-y-2 pt-1">
                  <p className="text-sm text-center text-muted-foreground">
                    {pickMeta.correct ? "回答正确。" : "回答错误，本题将排到本轮末尾。"}
                  </p>
                  <Button className="w-full" onClick={proceedAfterMeaningReveal}>
                    {pickMeta.correct ? "继续拼写" : "下一题"}
                  </Button>
                </div>
              )}
            </>
          )}
        </Card>
      )}

      {step === "spelling" && (
        <Card className="w-full p-6 space-y-5">
          <div className="rounded-lg border border-border bg-muted/30 px-3 py-3 text-center space-y-1">
            <p className="text-[11px] font-medium text-muted-foreground">中文释义</p>
            {spellGlossDisplay ? (
              <p className="text-sm font-medium text-foreground leading-snug">{spellGlossDisplay}</p>
            ) : (
              <div className="flex justify-center py-1">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden />
              </div>
            )}
            {!phraseSpelling && (
              <div className="flex justify-center items-center gap-1 pt-1 border-t border-border/60 mt-2">
                <ReviewPronunciationControls
                  word={current.word}
                  audioUsTrim={audioUsTrim}
                  audioUkTrim={audioUkTrim}
                  phrase={phraseSpelling}
                />
              </div>
            )}
          </div>

          {spellHintShown ? (
            <div className="rounded-md border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-center space-y-1">
              <p className="text-[11px] font-medium text-amber-950/80 dark:text-amber-100/90">提示</p>
              <p
                className={cn(
                  "font-semibold tracking-tight text-foreground",
                  spellHintLevel >= 2 ? "text-lg" : "text-xl font-mono"
                )}
              >
                {spellHintShown}
              </p>
            </div>
          ) : null}

          <div className="flex justify-center">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={spellHintLevel >= 2 || !spellKeyNorm}
              onClick={() => {
                clearSpellingAssemblyError();
                setManualSpelling("");
                setSpellHintLevel((h) => Math.min(2, h + 1));
              }}
            >
              <Lightbulb className="h-4 w-4 mr-2" />
              {spellHintLevel === 0
                ? "提示（先露出一部分）"
                : spellHintLevel === 1
                  ? "再提示（显示整词）"
                  : "已全部提示"}
            </Button>
          </div>

          <p className="text-sm font-medium text-center">
            {phraseSpelling
              ? "点选单词块组合，或在下方输入框键入完整词组（可用空格）"
              : spellingChunkCount > 0
                ? "点选字块/字母组合，或在下方输入框键入完整单词"
                : "点选字母组合，或在下方输入框键入完整单词"}
          </p>
          <div
            className={cn(
              "rounded-lg border border-dashed px-3 py-3 space-y-3 bg-muted/30 transition-[border-color,box-shadow] duration-200",
              spellingAssemblyError
                ? "border-destructive border-solid border-2 ring-2 ring-destructive/35"
                : "border-muted-foreground/40",
              spellingShakePlay && "animate-spelling-shake"
            )}
            aria-live="polite"
            aria-invalid={spellingAssemblyError}
          >
            <div className="min-h-10 flex flex-wrap gap-2 items-center justify-center">
              {spelling.usedIds.length > 0 ? (
                spelling.usedIds.map((id, i) => (
                  <span
                    key={`${id}-slot-${i}`}
                    className={cn(
                      "font-semibold",
                      phraseSpelling ? "text-lg tracking-tight" : "text-xl font-mono"
                    )}
                  >
                    {spelling.labels[id]}
                  </span>
                ))
              ) : manualSpelling.trim() !== "" ? (
                <span className="text-sm text-muted-foreground">当前使用键盘输入作答</span>
              ) : (
                <span className="text-sm text-muted-foreground">
                  {phraseSpelling
                    ? "点选下方单词块，或使用输入框"
                    : spellingChunkCount > 0
                      ? "点选下方字块或字母，或使用输入框"
                      : "点选下方字母，或使用输入框"}
                </span>
              )}
            </div>
            <Input
              type="text"
              value={manualSpelling}
              onChange={(e) => onManualSpellingChange(e.target.value)}
              placeholder={
                phraseSpelling
                  ? "手动输入完整词组（单词间可空格）"
                  : "手动输入完整单词"
              }
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              className={cn(
                "w-full font-mono text-base bg-background/80",
                phraseSpelling ? "tracking-tight" : ""
              )}
              aria-label={phraseSpelling ? "手动输入词组拼写" : "手动输入单词拼写"}
            />
          </div>
          {spellingAssemblyError ? (
            <p className="text-sm text-destructive text-center -mt-2">
              与目标拼写不符，请修改点选、输入框内容或清空后重试，拼对后才能提交进入下一词。
            </p>
          ) : null}

          <div className="w-full space-y-4">
            {spellingChunkCount > 0 ? (
              <>
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground text-center">字块</p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {spellingSlotOrder
                      .filter((id) => id < spellingChunkCount)
                      .map((id) => {
                        const picked = spellingUsedSet.has(id);
                        return (
                          <Button
                            key={id}
                            type="button"
                            variant="secondary"
                            size="sm"
                            disabled={picked}
                            className={cn(
                              "font-mono text-base min-w-9 px-3",
                              picked && "opacity-45 cursor-not-allowed"
                            )}
                            onClick={() => takeChip(id)}
                          >
                            {spelling.labels[id]}
                          </Button>
                        );
                      })}
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground text-center">字母</p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {spellingSlotOrder
                      .filter((id) => id >= spellingChunkCount)
                      .map((id) => {
                        const picked = spellingUsedSet.has(id);
                        return (
                          <Button
                            key={id}
                            type="button"
                            variant="secondary"
                            size="sm"
                            disabled={picked}
                            className={cn(
                              "font-mono text-base min-w-9 px-3",
                              picked && "opacity-45 cursor-not-allowed"
                            )}
                            onClick={() => takeChip(id)}
                          >
                            {spelling.labels[id]}
                          </Button>
                        );
                      })}
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-wrap gap-2 justify-center">
                {spellingSlotOrder.map((id) => {
                  const picked = spellingUsedSet.has(id);
                  return (
                    <Button
                      key={id}
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={picked}
                      className={cn(
                        phraseSpelling ? "text-base px-3" : "font-mono text-base min-w-9 px-3",
                        picked && "opacity-45 cursor-not-allowed"
                      )}
                      onClick={() => takeChip(id)}
                    >
                      {spelling.labels[id]}
                    </Button>
                  );
                })}
              </div>
            )}
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
            disabled={
              submitting ||
              (spelling.usedIds.length === 0 && manualSpelling.trim() === "")
            }
            onClick={() => void confirmSpelling()}
          >
            <CheckCircle2 className="h-4 w-4 mr-2" />
            {submitting ? "提交中…" : "确认拼写"}
          </Button>
        </Card>
      )}

      <p className="text-xs text-muted-foreground text-center px-2">
        释义干扰项优先来自与当前词相关的英文联想词（Datamuse），不足时辅以词库中近形词。拼写环节：单词同时提供字块与字母点选（各含少量干扰），也可在输入框内手动键入；词组按单词块点选或手动输入均可。
      </p>
    </div>
  );
}
