"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, BookmarkPlus, BookmarkCheck, BookmarkMinus, X, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { clientFetch, CLIENT_FETCH_NETWORK_ERROR } from "@/lib/client-fetch";
import { toastConfirmAction } from "@/lib/toast-confirm";
import { serializeVocabularyDefinition } from "@/lib/vocabulary-definition";
import { linkifyToReactNodes } from "@/components/linkified-text";
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

/** 与 epub-reader 中换算后的选区包围盒一致（宿主视口坐标） */
export interface WordPopupAnchorRect {
  top: number;
  left: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

interface WordPopupProps {
  word: string;
  context: string;
  contextCfi: string;
  bookId: string;
  anchorRect: WordPopupAnchorRect;
  onClose: () => void;
  onSaved: () => void;
}

const VIEW_MARGIN = 8;
/** 与选区之间的最小间隙（像素），保证弹窗与选区不相交 */
const ANCHOR_GAP = 8;
/** 顶栏约 3.5rem，弹窗不要钻进顶栏下沿 */
const TOP_MIN = 56;

function popupBounds(left: number, top: number, w: number, h: number) {
  return { left, top, right: left + w, bottom: top + h };
}

/** 弹窗矩形与选区至少相隔 ANCHOR_GAP（不相交且不贴死） */
function noOverlapWithAnchor(
  p: { left: number; top: number; right: number; bottom: number },
  anchor: WordPopupAnchorRect,
): boolean {
  return (
    p.right <= anchor.left - ANCHOR_GAP ||
    p.left >= anchor.right + ANCHOR_GAP ||
    p.bottom <= anchor.top - ANCHOR_GAP ||
    p.top >= anchor.bottom + ANCHOR_GAP
  );
}

/**
 * 优先放在选区「右上」外侧：先右侧+上方，再右侧+下方、左侧+上/下；均保证与选区不重叠。
 */
function computePopupPosition(
  anchor: WordPopupAnchorRect,
  popupW: number,
  popupH: number,
  vw: number,
  vh: number,
): { top: number; left: number } {
  const candidates: Array<{ left: number; top: number }> = [
    { left: anchor.right + ANCHOR_GAP, top: anchor.top - ANCHOR_GAP - popupH },
    { left: anchor.right + ANCHOR_GAP, top: anchor.bottom + ANCHOR_GAP },
    { left: anchor.left - ANCHOR_GAP - popupW, top: anchor.top - ANCHOR_GAP - popupH },
    { left: anchor.left - ANCHOR_GAP - popupW, top: anchor.bottom + ANCHOR_GAP },
  ];

  for (const c of candidates) {
    const left = Math.min(Math.max(VIEW_MARGIN, c.left), vw - popupW - VIEW_MARGIN);
    const top = Math.min(Math.max(TOP_MIN, c.top), vh - popupH - VIEW_MARGIN);
    const p = popupBounds(left, top, popupW, popupH);
    if (noOverlapWithAnchor(p, anchor)) {
      return { left, top };
    }
  }

  const cx = (anchor.left + anchor.right) / 2;
  const cy = (anchor.top + anchor.bottom) / 2;
  let left = cx < vw / 2 ? vw - popupW - VIEW_MARGIN : VIEW_MARGIN;
  let top = cy < vh / 2 ? vh - popupH - VIEW_MARGIN : TOP_MIN;
  left = Math.min(Math.max(VIEW_MARGIN, left), vw - popupW - VIEW_MARGIN);
  top = Math.min(Math.max(TOP_MIN, top), vh - popupH - VIEW_MARGIN);
  let p = popupBounds(left, top, popupW, popupH);
  if (!noOverlapWithAnchor(p, anchor)) {
    top = Math.min(Math.max(TOP_MIN, anchor.bottom + ANCHOR_GAP), vh - popupH - VIEW_MARGIN);
    left = Math.min(Math.max(VIEW_MARGIN, left), vw - popupW - VIEW_MARGIN);
    p = popupBounds(left, top, popupW, popupH);
  }
  if (!noOverlapWithAnchor(p, anchor)) {
    top = Math.min(Math.max(TOP_MIN, anchor.top - ANCHOR_GAP - popupH), vh - popupH - VIEW_MARGIN);
    left = Math.min(Math.max(VIEW_MARGIN, left), vw - popupW - VIEW_MARGIN);
  }
  return { top, left };
}

export function WordPopup({
  word,
  context,
  contextCfi,
  bookId,
  anchorRect,
  onClose,
  onSaved,
}: WordPopupProps) {
  const t = useTranslations("wordPopup");
  const rootRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const [phonetic, setPhonetic] = useState("");
  const [definitions, setDefinitions] = useState<Definition[]>([]);
  const [translation, setTranslation] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [audioUk, setAudioUk] = useState("");
  const [audioUs, setAudioUs] = useState("");
  const [existingEntryId, setExistingEntryId] = useState<string | null>(null);
  const [lookupLoading, setLookupLoading] = useState(true);
  const [removing, setRemoving] = useState(false);

  /** 多词为词组：无词典 mp3，仍可提供系统 TTS 朗读整段 */
  const isPhrase = word.trim().split(/\s+/).length > 1;

  useEffect(() => {
    stopPronunciationAudio();
    return () => {
      stopPronunciationAudio();
    };
  }, [word]);

  // 是否已在生词本（与 POST 的 normalizedWord 规则一致）
  useEffect(() => {
    let cancelled = false;
    const key = word.trim().toLowerCase();
    async function fetchLookup() {
      setLookupLoading(true);
      setExistingEntryId(null);
      if (!key) {
        if (!cancelled) setLookupLoading(false);
        return;
      }
      try {
        const res = await clientFetch(
          `/api/vocabulary?lookup=${encodeURIComponent(key)}`,
          { showErrorToast: false },
        );
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { entry?: { id: string } | null };
        if (cancelled) return;
        setExistingEntryId(data.entry?.id ?? null);
      } catch {
        if (!cancelled) setExistingEntryId(null);
      } finally {
        if (!cancelled) setLookupLoading(false);
      }
    }
    void fetchLookup();
    return () => {
      cancelled = true;
    };
  }, [word]);

  // 查询释义 + 中文翻译 + dictionaryapi.dev 英/美 mp3
  useEffect(() => {
    let cancelled = false;
    async function fetchDefinition() {
      setLoading(true);
      setPhonetic("");
      setDefinitions([]);
      setTranslation("");
      setAudioUk("");
      setAudioUs("");
      setSaved(false);
      try {
        const res = await clientFetch(`/api/dictionary?word=${encodeURIComponent(word)}`, {
          showErrorToast: false,
        });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        setPhonetic(data.phonetic ?? "");
        setDefinitions(data.definitions ?? []);
        setTranslation(data.translation ?? "");
        setAudioUk(typeof data.audioUk === "string" ? data.audioUk : "");
        setAudioUs(typeof data.audioUs === "string" ? data.audioUs : "");
      } catch {
        if (!cancelled) setDefinitions([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchDefinition();
    return () => { cancelled = true; };
  }, [word]);

  useLayoutEffect(() => {
    function measure() {
      const el = rootRef.current;
      if (!el) return;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      if (w === 0 || h === 0) return;
      setPosition(computePopupPosition(anchorRect, w, h, vw, vh));
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [
    anchorRect,
    word,
    loading,
    definitions.length,
    translation,
    saved,
    audioUk,
    audioUs,
    existingEntryId,
    lookupLoading,
    removing,
  ]);

  function speakTts() {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(word);
    utterance.lang = "en-US";
    window.speechSynthesis.speak(utterance);
  }

  /** 优先用词典 CDN 的 mp3（可直连播放）；失败时退回 TTS（仅单词） */
  function playPronunciationMp3(url: string) {
    playPronunciationMp3Url(url, speakTts);
  }

  const hasSavableDefinition =
    definitions.length > 0 || translation.trim().length > 0;

  async function handleSave() {
    if (!word.trim() || !hasSavableDefinition || loading || lookupLoading) return;
    setSaving(true);
    try {
      const definitionStr = serializeVocabularyDefinition(definitions, translation);

      const res = await clientFetch("/api/vocabulary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          word,
          bookId,
          context,
          contextCfi,
          definition: definitionStr,
          phonetic,
          ...(audioUs.trim() ? { audioUs: audioUs.trim() } : {}),
          ...(audioUk.trim() ? { audioUk: audioUk.trim() } : {}),
        }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        id?: string;
        alreadyExists?: boolean;
      };

      if (!res.ok) {
        return;
      }

      if (data.alreadyExists && data.id) {
        setExistingEntryId(data.id);
        toast.message(t("alreadyIn", { word }));
        return;
      }
      if (data.id) setExistingEntryId(data.id);
      setSaved(true);
      toast.success(t("addedSuccess", { word }));
      onSaved();
    } catch {
      toast.error(CLIENT_FETCH_NETWORK_ERROR);
    } finally {
      setSaving(false);
    }
  }

  function handleRemoveClick() {
    if (!existingEntryId || removing) return;
    const entryId = existingEntryId;
    const label = word;
    toastConfirmAction({
      message: t("deleteConfirm", { word: label }),
      description: t("deleteDescription"),
      confirmLabel: t("confirmDelete"),
      onConfirm: async () => {
        setRemoving(true);
        try {
          const res = await clientFetch(`/api/vocabulary/${entryId}`, {
            method: "DELETE",
          });
          if (res.ok) {
            setExistingEntryId(null);
            toast.success(t("removedSuccess", { word: label }));
          }
        } catch {
          toast.error(CLIENT_FETCH_NETWORK_ERROR);
        } finally {
          setRemoving(false);
        }
      },
    });
  }

  return (
    <div
      ref={rootRef}
      className="fixed z-[100] flex min-h-0 w-[min(18rem,calc(100vw-1rem))] flex-col gap-2 overflow-hidden rounded-xl border border-border bg-popover p-3 text-sm shadow-xl h-[22vh] md:h-auto md:max-h-[65vh]"
      style={{
        ...(position
          ? { top: position.top, left: position.left, right: "auto", visibility: "visible" as const }
          : { top: TOP_MIN, left: VIEW_MARGIN, visibility: "hidden" as const }),
      }}
    >
      {/* 标题行：单词/词组 + 音标 + 发音 + 关闭 */}
      <div className="flex shrink-0 items-start justify-between gap-1">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div
            className="line-clamp-2 min-h-0 wrap-break-word text-base font-bold leading-snug"
            title={word}
          >
            {word}
          </div>
          {phonetic ? (
            <span className="shrink-0 text-xs text-muted-foreground">{phonetic}</span>
          ) : null}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {!loading &&
            (isPhrase ? (
              <button
                type="button"
                onClick={speakTts}
                className="text-muted-foreground hover:text-foreground p-0.5 rounded"
                title={t("ttsPronunciation")}
              >
                <Volume2 className="h-3.5 w-3.5" />
              </button>
            ) : (
              <>
                {audioUs && audioUk ? (
                  <>
                    <button
                      type="button"
                      onClick={() => playPronunciationMp3(audioUs)}
                      className="text-muted-foreground hover:text-foreground px-1 py-0.5 rounded text-xs font-medium leading-none"
                      title={t("usAccent")}
                    >
                      {t("usAccent")}
                    </button>
                    <button
                      type="button"
                      onClick={() => playPronunciationMp3(audioUk)}
                      className="text-muted-foreground hover:text-foreground px-1 py-0.5 rounded text-xs font-medium leading-none"
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
              </>
            ))}
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-0.5 rounded"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain">
        {/* 查询中 */}
        {loading ? (
          <div className="flex items-center gap-2 py-2 text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span className="text-xs">{t("lookingUp")}</span>
          </div>
        ) : (
          <>
            {/* 中文翻译（放在英文释义前面，更直观） */}
            {translation && (
              <div className="mb-2 rounded-md bg-muted/60 px-2 py-1.5">
                <p className="text-xs font-medium text-foreground">{translation}</p>
              </div>
            )}

            {/* 英文释义（单词时才有） */}
            {definitions.length > 0 && (
              <div className="mb-2 space-y-1.5">
                {definitions.slice(0, 2).map((def, i) => (
                  <div key={i}>
                    <Badge variant="secondary" className="mr-1 px-1 py-0 text-xs">
                      {def.partOfSpeech}
                    </Badge>
                    <span className="text-xs text-foreground">{def.definition}</span>
                    {def.example && (
                      <p className="mt-0.5 pl-2 text-xs italic text-muted-foreground">
                        {def.example}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* 无释义也无翻译 */}
            {!translation && definitions.length === 0 && (
              <p className="mb-2 text-xs text-muted-foreground">{t("noDefinition")}</p>
            )}
          </>
        )}

        {/* 上下文（与选词一致最多 2 行，避免占满卡片） */}
        {context ? (
          <div
            className="mt-2 min-w-0 border-l-2 border-muted pl-2 text-xs italic text-muted-foreground line-clamp-2 wrap-break-word"
            title={context}
          >
            {linkifyToReactNodes(context)}
          </div>
        ) : null}
      </div>

      {/* 生词本：已收录可移除；未收录须等释义加载完成且有可保存内容 */}
      {existingEntryId ? (
        <Button
          size="sm"
          className="h-7 w-full shrink-0 text-xs"
          onClick={handleRemoveClick}
          disabled={removing}
          variant="outline"
        >
          {removing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
          ) : (
            <BookmarkMinus className="h-3.5 w-3.5 mr-1" />
          )}
          {t("removeFromVocab")}
        </Button>
      ) : (
        <Button
          size="sm"
          className="h-7 w-full shrink-0 text-xs"
          onClick={handleSave}
          disabled={
            saving ||
            saved ||
            loading ||
            lookupLoading ||
            !word.trim() ||
            !hasSavableDefinition
          }
          variant={saved ? "secondary" : "default"}
          title={
            !word.trim()
              ? t("noSelectedWord")
              : loading || lookupLoading
                ? t("waitLoading")
                : !hasSavableDefinition
                  ? t("noDefinitionForSave")
                  : undefined
          }
        >
          {saving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
          ) : saved ? (
            <BookmarkCheck className="h-3.5 w-3.5 mr-1" />
          ) : (
            <BookmarkPlus className="h-3.5 w-3.5 mr-1" />
          )}
          {saved ? t("addedToVocab") : t("addToVocab")}
        </Button>
      )}
    </div>
  );
}
