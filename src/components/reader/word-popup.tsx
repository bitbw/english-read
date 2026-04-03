"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, BookmarkPlus, BookmarkCheck, X, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { clientFetch } from "@/lib/client-fetch";

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
  const audioRef = useRef<HTMLAudioElement | null>(null);

  /** 与 /api/dictionary 一致：多词/整句不展示发音（无词典音频，也不 TTS 念整段） */
  const isPhrase = word.trim().split(/\s+/).length > 1;

  useEffect(() => {
    audioRef.current?.pause();
    return () => {
      audioRef.current?.pause();
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
        console.log("[word-popup] GET /api/dictionary?word=… 返回:", data);
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
  }, [anchorRect, word, loading, definitions.length, translation, saved, audioUk, audioUs]);

  function speakTts() {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(word);
    utterance.lang = "en-US";
    window.speechSynthesis.speak(utterance);
  }

  /** 优先用词典 CDN 的 mp3（可直连播放）；失败时退回 TTS（仅单词） */
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

  async function handleSave() {
    setSaving(true);
    try {
      const translationTrim = translation.trim();
      const definitionStr =
        definitions.length > 0
          ? JSON.stringify(
              definitions.slice(0, 3).map((d) => ({
                pos: d.partOfSpeech,
                def: d.definition,
                ...(translationTrim ? { zh: translationTrim } : {}),
              }))
            )
          : translationTrim
            ? JSON.stringify([
                { pos: "译", def: translationTrim, zh: translationTrim },
              ])
            : undefined;

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
        }),
      });

      if (res.ok) {
        setSaved(true);
        toast.success(`"${word}" 已加入生词本`);
        onSaved();
      }
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      ref={rootRef}
      className="fixed z-[100] w-[min(18rem,calc(100vw-1rem))] max-h-[22vh] md:max-h-[65vh] bg-popover border border-border rounded-xl shadow-xl p-3 text-sm overflow-y-auto"
      style={{
        ...(position
          ? { top: position.top, left: position.left, right: "auto", visibility: "visible" as const }
          : { top: TOP_MIN, left: VIEW_MARGIN, visibility: "hidden" as const }),
      }}
    >
      {/* 标题行：单词/词组 + 音标 + 发音 + 关闭 */}
      <div className="flex items-start justify-between gap-1 mb-2">
        <div className="flex-1 min-w-0">
          <span className="font-bold text-base break-words leading-snug">{word}</span>
          {phonetic && (
            <span className="ml-1.5 text-muted-foreground text-xs">{phonetic}</span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {!isPhrase && !loading && (
            <>
              {audioUs && audioUk ? (
                <>
                  <button
                    type="button"
                    onClick={() => playPronunciationMp3(audioUs)}
                    className="text-muted-foreground hover:text-foreground px-1 py-0.5 rounded text-xs font-medium leading-none"
                    title="美音"
                  >
                    美
                  </button>
                  <button
                    type="button"
                    onClick={() => playPronunciationMp3(audioUk)}
                    className="text-muted-foreground hover:text-foreground px-1 py-0.5 rounded text-xs font-medium leading-none"
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
            </>
          )}
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-0.5 rounded"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* 查询中 */}
      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground py-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span className="text-xs">查询中...</span>
        </div>
      ) : (
        <>
          {/* 中文翻译（放在英文释义前面，更直观） */}
          {translation && (
            <div className="mb-2 px-2 py-1.5 bg-muted/60 rounded-md">
              <p className="text-xs font-medium text-foreground">{translation}</p>
            </div>
          )}

          {/* 英文释义（单词时才有） */}
          {definitions.length > 0 && (
            <div className="space-y-1.5 mb-2 max-h-32 overflow-y-auto">
              {definitions.slice(0, 3).map((def, i) => (
                <div key={i}>
                  <Badge variant="secondary" className="text-xs mr-1 px-1 py-0">
                    {def.partOfSpeech}
                  </Badge>
                  <span className="text-xs text-foreground">{def.definition}</span>
                  {def.example && (
                    <p className="text-xs text-muted-foreground italic mt-0.5 pl-2">
                      {def.example}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* 无释义也无翻译 */}
          {!translation && definitions.length === 0 && (
            <p className="text-xs text-muted-foreground mb-2">暂无释义</p>
          )}
        </>
      )}

      {/* 上下文 */}
      {context && (
        <p className="text-xs text-muted-foreground italic mb-2 line-clamp-2 border-l-2 border-muted pl-2">
          {context}
        </p>
      )}

      {/* 加入生词本 */}
      <Button
        size="sm"
        className="w-full text-xs h-7"
        onClick={handleSave}
        disabled={saving || saved}
        variant={saved ? "secondary" : "default"}
      >
        {saving ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
        ) : saved ? (
          <BookmarkCheck className="h-3.5 w-3.5 mr-1" />
        ) : (
          <BookmarkPlus className="h-3.5 w-3.5 mr-1" />
        )}
        {saved ? "已加入生词本" : "加入生词本"}
      </Button>
    </div>
  );
}
