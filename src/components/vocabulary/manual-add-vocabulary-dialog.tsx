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
import { serializeVocabularyDefinition } from "@/lib/vocabulary-definition";
import {
  playPronunciationMp3 as playPronunciationMp3Url,
  stopPronunciationAudio,
} from "@/lib/pronunciation-audio";
import { useTranslations } from "next-intl";

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
  const t = useTranslations("dialog");
  const [word, setWord] = useState("");
  const [reference, setReference] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [dictLoading, setDictLoading] = useState(false);
  const [phonetic, setPhonetic] = useState("");
  const [definitions, setDefinitions] = useState<Definition[]>([]);
  const [translation, setTranslation] = useState("");
  const [audioUk, setAudioUk] = useState("");
  const [audioUs, setAudioUs] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [alreadyInVocabulary, setAlreadyInVocabulary] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const trimmedWord = word.trim();
  const isPhrase = trimmedWord.split(/\s+/).length > 1;

  useEffect(() => {
    stopPronunciationAudio();
    return () => {
      stopPronunciationAudio();
    };
  }, [trimmedWord]);

  useEffect(() => {
    abortRef.current?.abort();
    abortRef.current = null;

    if (!open) {
      setDictLoading(false);
      setLookupLoading(false);
      setAlreadyInVocabulary(false);
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
      setLookupLoading(false);
      setAlreadyInVocabulary(false);
      setPhonetic("");
      setDefinitions([]);
      setTranslation("");
      setAudioUk("");
      setAudioUs("");
      return;
    }

    // 新输入先清空旧释义并进入加载态，避免防抖窗口内仍显示上一次的释义从而误点「加入生词本」
    setPhonetic("");
    setDefinitions([]);
    setTranslation("");
    setAudioUk("");
    setAudioUs("");
    setDictLoading(true);

    const tid = setTimeout(() => {
      const ac = new AbortController();
      abortRef.current = ac;
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

  /** 与阅读划词一致：防抖后查 normalizedWord 是否已在生词本 */
  useEffect(() => {
    let cancelled = false;
    if (!open) {
      setLookupLoading(false);
      setAlreadyInVocabulary(false);
      return;
    }
    const key = word.trim().toLowerCase();
    if (!key) {
      setLookupLoading(false);
      setAlreadyInVocabulary(false);
      return;
    }
    setLookupLoading(true);
    setAlreadyInVocabulary(false);
    const tid = setTimeout(() => {
      void (async () => {
        try {
          const res = await clientFetch(
            `/api/vocabulary?lookup=${encodeURIComponent(key)}`,
            { showErrorToast: false },
          );
          if (!res.ok || cancelled) return;
          const data = (await res.json()) as { entry?: { id: string } | null };
          if (cancelled) return;
          setAlreadyInVocabulary(Boolean(data.entry?.id));
        } catch {
          if (!cancelled) setAlreadyInVocabulary(false);
        } finally {
          if (!cancelled) setLookupLoading(false);
        }
      })();
    }, 450);
    return () => {
      cancelled = true;
      clearTimeout(tid);
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
    playPronunciationMp3Url(url, speakTts);
  }

  const hasSavableDefinition =
    definitions.length > 0 || translation.trim().length > 0;
  const canSubmitToVocab =
    Boolean(trimmedWord) &&
    !dictLoading &&
    !lookupLoading &&
    hasSavableDefinition &&
    !alreadyInVocabulary;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const w = trimmedWord;
    if (!w) {
      toast.error(t("fillWord"));
      return;
    }
    if (!canSubmitToVocab || alreadyInVocabulary) {
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
          ...(audioUs.trim() ? { audioUs: audioUs.trim() } : {}),
          ...(audioUk.trim() ? { audioUk: audioUk.trim() } : {}),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as VocabWord & {
        alreadyExists?: boolean;
      };

      if (!res.ok) {
        return;
      }
      if (data.alreadyExists) {
        toast.message(t("alreadyExists", { word: w }));
        onOpenChange(false);
        return;
      }
      toast.success(t("addedSuccess", { word: w }));
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[min(85vh,calc(100dvh-2rem))] overflow-y-auto" showCloseButton>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{t("addVocabTitle")}</DialogTitle>
            <DialogDescription>
              {t("addVocabDesc")}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-2">
              <Label htmlFor="vocab-manual-word">{t("wordLabel")}</Label>
              <Input
                id="vocab-manual-word"
                value={word}
                onChange={(e) => setWord(e.target.value)}
                placeholder={t("wordPlaceholder")}
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
                    <span className="text-xs text-muted-foreground">{t("noWordYet")}</span>
                  )}
                </div>
                {trimmedWord && !dictLoading ? (
                  <div className="flex shrink-0 items-center gap-0.5">
                    {isPhrase ? (
                      <button
                        type="button"
                        onClick={speakTts}
                        className="text-muted-foreground hover:text-foreground p-0.5 rounded"
                        title={t("ttsPronunciation")}
                      >
                        <Volume2 className="h-3.5 w-3.5" />
                      </button>
                    ) : audioUs && audioUk ? (
                      <>
                        <button
                          type="button"
                          onClick={() => playPronunciationMp3(audioUs)}
                          className="text-muted-foreground hover:text-foreground px-1 py-0.5 rounded text-xs font-medium"
                          title={t("usAccent")}
                        >
                          {t("usAccent")}
                        </button>
                        <button
                          type="button"
                          onClick={() => playPronunciationMp3(audioUk)}
                          className="text-muted-foreground hover:text-foreground px-1 py-0.5 rounded text-xs font-medium"
                          title={t("ukAccent")}
                        >
                          {t("ukAccent")}
                        </button>
                      </>
                    ) : audioUs || audioUk ? (
                      <button
                        type="button"
                        onClick={() => playPronunciationMp3(audioUs || audioUk)}
                        className="text-muted-foreground hover:text-foreground p-0.5 rounded"
                        title={audioUs ? t("usAccent") : t("ukAccent")}
                      >
                        <Volume2 className="h-3.5 w-3.5" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={speakTts}
                        className="text-muted-foreground hover:text-foreground p-0.5 rounded"
                        title={t("ttsPronunciation")}
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
                  <span className="text-xs">{t("lookingUpDef")}</span>
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
                    <p className="text-xs text-muted-foreground">
                      {t("noDefinitionOrTranslation")}
                    </p>
                  ) : null}
                </>
              ) : null}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="vocab-manual-ref">{t("contextLabel")}</Label>
              <Textarea
                id="vocab-manual-ref"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder={t("contextPlaceholder")}
                rows={3}
                maxLength={4000}
                className="resize-y min-h-[72px]"
              />
            </div>
          </div>
          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("cancel")}
            </Button>
            <Button
              type="submit"
              disabled={submitting || !canSubmitToVocab}
              variant={alreadyInVocabulary ? "secondary" : "default"}
              title={
                !trimmedWord
                  ? t("titleEnterWord")
                  : dictLoading
                    ? t("titleWaitingDef")
                    : lookupLoading
                      ? t("titleCheckingVocab")
                      : alreadyInVocabulary
                        ? t("titleAlreadyIn")
                        : !hasSavableDefinition
                          ? t("titleNoDefinition")
                          : undefined
              }
            >
              {submitting
                ? t("submitting")
                : alreadyInVocabulary
                  ? t("alreadyInVocab")
                  : lookupLoading && trimmedWord
                    ? t("checkingVocab")
                    : t("addToVocab")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
