"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { clientFetch, CLIENT_FETCH_NETWORK_ERROR } from "@/lib/client-fetch";
import { VOCAB_DAILY_LIMIT_CODE } from "@/lib/vocabulary-daily-limit";
import { VocabularyDailyLimitDialog } from "@/components/vocabulary/vocabulary-daily-limit-dialog";
import { serializeVocabularyDefinition } from "@/lib/vocabulary-definition";

interface Definition {
  partOfSpeech: string;
  definition: string;
  example?: string;
}

interface VocabWord {
  id: string;
  word: string;
  alreadyExists?: boolean;
}

type ManualAddVocabularyDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdded: () => void | Promise<void>;
};

export function ManualAddVocabularyDialog({
  open,
  onOpenChange,
  onAdded,
}: ManualAddVocabularyDialogProps) {
  const [word, setWord] = useState("");
  const [reference, setReference] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [dictLoading, setDictLoading] = useState(false);
  const [phonetic, setPhonetic] = useState("");
  const [definitions, setDefinitions] = useState<Definition[]>([]);
  const [translation, setTranslation] = useState("");
  const [audioUk, setAudioUk] = useState("");
  const [audioUs, setAudioUs] = useState("");
  const [dailyLimitOpen, setDailyLimitOpen] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const trimmedWord = word.trim();
  const isPhrase = trimmedWord.split(/\s+/).length > 1;

  useEffect(() => {
    audioRef.current?.pause();
    return () => {
      audioRef.current?.pause();
    };
  }, [trimmedWord]);

  useEffect(() => {
    abortRef.current?.abort();
    abortRef.current = null;

    if (!open) {
      setDictLoading(false);
      setPhonetic("");
      setDefinitions([]);
      setTranslation("");
      setAudioUk("");
      setAudioUs("");
      return;
    }

    const q = word.trim();
    if (!q) {
      setDictLoading(false);
      setPhonetic("");
      setDefinitions([]);
      setTranslation("");
      setAudioUk("");
      setAudioUs("");
      return;
    }

    const tid = setTimeout(() => {
      const ac = new AbortController();
      abortRef.current = ac;
      setDictLoading(true);
      void (async () => {
        try {
          /** 须用原生 fetch：clientFetch 会把 AbortError 包装成网络错误，无法正确取消防抖请求 */
          const res = await fetch(`/api/dictionary?word=${encodeURIComponent(q)}`, {
            signal: ac.signal,
          });
          if (!res.ok) {
            if (!ac.signal.aborted) {
              setPhonetic("");
              setDefinitions([]);
              setTranslation("");
              setAudioUk("");
              setAudioUs("");
            }
            return;
          }
          const data = (await res.json()) as {
            phonetic?: string;
            definitions?: Definition[];
            translation?: string;
            audioUk?: string;
            audioUs?: string;
          };
          if (ac.signal.aborted) return;
          setPhonetic(data.phonetic ?? "");
          setDefinitions(Array.isArray(data.definitions) ? data.definitions : []);
          setTranslation(data.translation ?? "");
          setAudioUk(typeof data.audioUk === "string" ? data.audioUk : "");
          setAudioUs(typeof data.audioUs === "string" ? data.audioUs : "");
        } catch (e) {
          if ((e as { name?: string })?.name === "AbortError") return;
          if (!ac.signal.aborted) {
            setPhonetic("");
            setDefinitions([]);
            setTranslation("");
            setAudioUk("");
            setAudioUs("");
          }
        } finally {
          if (!ac.signal.aborted) setDictLoading(false);
        }
      })();
    }, 450);

    return () => {
      clearTimeout(tid);
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, [open, word]);

  function speakTts() {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(trimmedWord);
    utterance.lang = "en-US";
    window.speechSynthesis.speak(utterance);
  }

  function playPronunciationMp3(url: string) {
    if (typeof window === "undefined") return;
    try {
      audioRef.current?.pause();
      const a = new Audio(url);
      audioRef.current = a;
      void a.play().catch(() => {
        speakTts();
      });
    } catch {
      speakTts();
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const w = trimmedWord;
    if (!w) {
      toast.error("请填写单词或短语");
      return;
    }
    setSubmitting(true);
    try {
      const definitionStr = serializeVocabularyDefinition(definitions, translation);
      const res = await clientFetch("/api/vocabulary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          word: w,
          context: reference.trim() || undefined,
          ...(definitionStr ? { definition: definitionStr } : {}),
          ...(phonetic.trim() ? { phonetic: phonetic.trim() } : {}),
        }),
        showErrorToast: false,
      });
      const data = (await res.json().catch(() => ({}))) as VocabWord & {
        alreadyExists?: boolean;
        error?: unknown;
        code?: string;
      };

      if (res.status === 429 && data.code === VOCAB_DAILY_LIMIT_CODE) {
        setDailyLimitOpen(true);
        return;
      }

      if (!res.ok) {
        const msg =
          typeof data.error === "string"
            ? data.error
            : data.error
              ? "请求被拒绝，请刷新页面或重新登录后再试"
              : `请求失败（HTTP ${res.status}）`;
        toast.error(msg);
        return;
      }
      if (data.alreadyExists) {
        toast.message(`「${w}」已在生词本中`);
        onOpenChange(false);
        return;
      }
      toast.success(`「${w}」已加入生词本，将按复习计划提醒`);
      setWord("");
      setReference("");
      setPhonetic("");
      setDefinitions([]);
      setTranslation("");
      setAudioUk("");
      setAudioUs("");
      onOpenChange(false);
      await onAdded();
    } catch {
      toast.error(CLIENT_FETCH_NETWORK_ERROR);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[min(85vh,calc(100dvh-2rem))] overflow-y-auto" showCloseButton>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>手动添加生词</DialogTitle>
            <DialogDescription>
              输入后会自动查询音标与释义（与阅读划词相同数据源）；加入生词本时一并保存，并进入复习计划。
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-2">
              <Label htmlFor="vocab-manual-word">单词或短语</Label>
              <Input
                id="vocab-manual-word"
                value={word}
                onChange={(e) => setWord(e.target.value)}
                placeholder="例如：serendipity 或 in spite of"
                maxLength={500}
                autoComplete="off"
              />
            </div>

            {/* 预览：音标 + 发音 + 释义 */}
            <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0 flex-1">
                  {trimmedWord ? (
                    <>
                      <span className="font-medium text-sm wrap-break-word">{trimmedWord}</span>
                      {phonetic ? (
                        <span className="ml-1.5 text-muted-foreground text-xs">{phonetic}</span>
                      ) : null}
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground">输入单词或短语后将显示音标与释义</span>
                  )}
                </div>
                {trimmedWord && !isPhrase && !dictLoading ? (
                  <div className="flex shrink-0 items-center gap-0.5">
                    {audioUs && audioUk ? (
                      <>
                        <button
                          type="button"
                          onClick={() => playPronunciationMp3(audioUs)}
                          className="text-muted-foreground hover:text-foreground px-1 py-0.5 rounded text-xs font-medium"
                          title="美音"
                        >
                          美
                        </button>
                        <button
                          type="button"
                          onClick={() => playPronunciationMp3(audioUk)}
                          className="text-muted-foreground hover:text-foreground px-1 py-0.5 rounded text-xs font-medium"
                          title="英音"
                        >
                          英
                        </button>
                      </>
                    ) : audioUs || audioUk ? (
                      <button
                        type="button"
                        onClick={() => playPronunciationMp3(audioUs || audioUk)}
                        className="text-muted-foreground hover:text-foreground p-0.5 rounded"
                        title={audioUs ? "美音" : "英音"}
                      >
                        <Volume2 className="h-3.5 w-3.5" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={speakTts}
                        className="text-muted-foreground hover:text-foreground p-0.5 rounded"
                        title="发音（语音合成）"
                      >
                        <Volume2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ) : null}
              </div>

              {dictLoading ? (
                <div className="flex items-center gap-2 text-muted-foreground py-1">
                  <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
                  <span className="text-xs">查询释义中…</span>
                </div>
              ) : trimmedWord ? (
                <>
                  {translation ? (
                    <div className="mb-2 px-2 py-1.5 bg-muted/60 rounded-md">
                      <p className="text-xs font-medium text-foreground">{translation}</p>
                    </div>
                  ) : null}
                  {definitions.length > 0 ? (
                    <div className="space-y-1.5 max-h-36 overflow-y-auto">
                      {definitions.slice(0, 2).map((def, i) => (
                        <div key={i}>
                          <Badge variant="secondary" className="text-xs mr-1 px-1 py-0">
                            {def.partOfSpeech}
                          </Badge>
                          <span className="text-xs text-foreground">{def.definition}</span>
                          {def.example ? (
                            <p className="text-xs text-muted-foreground italic mt-0.5 pl-2">
                              {def.example}
                            </p>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {!translation && definitions.length === 0 ? (
                    <p className="text-xs text-muted-foreground">暂无词典结果（仍可加入生词本）</p>
                  ) : null}
                </>
              ) : null}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="vocab-manual-ref">引用（可选）</Label>
              <Textarea
                id="vocab-manual-ref"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="原文句子、书名章节或你自己的笔记…"
                rows={3}
                maxLength={4000}
                className="resize-y min-h-[72px]"
              />
            </div>
          </div>
          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "添加中…" : "加入生词本"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
    <VocabularyDailyLimitDialog open={dailyLimitOpen} onOpenChange={setDailyLimitOpen} />
    </>
  );
}
