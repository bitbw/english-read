"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { format } from "date-fns";
import { BackButton } from "@/components/back-button";
import { ExternalLink, Eye, EyeOff, Settings, Volume2, VolumeX } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { buttonVariants } from "@/components/ui/button-variants";
import {
  readAutoPronunciationFromStorage,
  writeAutoPronunciationToStorage,
} from "@/lib/reader-auto-pronunciation";
import { debounce } from "@/lib/debounce";
import { WordPopup, type WordPopupAnchorRect } from "@/components/reader/word-popup";
import { cn } from "@/lib/utils";
import { extractReadableContext } from "@/lib/extract-readable-context";
import { VOCAB_CONTEXT_MAX_LENGTH, VOCAB_WORD_MAX_LENGTH } from "@/lib/vocabulary-limits";
import { useTranslations } from "next-intl";
import { useReadingTimeTracker } from "@/hooks/use-reading-time-tracker";

interface Article {
  id: string;
  slug: string;
  level: number;
  title: string;
  description: string | null;
  coverUrl: string | null;
  content: string;
  wordCount: number | null;
  publishedAt: Date | null;
  createdAt: Date;
  sourceUrl: string;
}

interface PopupState {
  word: string;
  context: string;
  anchorRect: WordPopupAnchorRect;
}

const levelLabel: Record<number, string> = { 1: "Level 1", 2: "Level 2", 3: "Level 3" };
const levelColor: Record<number, string> = {
  1: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  2: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  3: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
};

const ARTICLE_FONT_SIZE_KEY = "english-read-article-font-size";

export function ArticleReaderClient({ article }: { article: Article }) {
  const t = useTranslations("articles");
  const tReader = useTranslations("reader");
  const contentRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const [popup, setPopup] = useState<PopupState | null>(null);
  const [showCover, setShowCover] = useState(true);
  const [fontSize, setFontSize] = useState(17);
  const [autoPronunciation, setAutoPronunciation] = useState(readAutoPronunciationFromStorage);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // 阅读时长追踪（页面可见时自动上报到 readingDailyTime）
  useReadingTimeTracker({ enabled: true });

  const closePopup = useCallback(() => {
    setPopup(null);
    window.getSelection()?.removeAllRanges();
  }, []);

  // 从 localStorage 加载字号
  useEffect(() => {
    try {
      const saved = localStorage.getItem(ARTICLE_FONT_SIZE_KEY);
      if (saved) {
        const n = parseInt(saved, 10);
        if (n >= 14 && n <= 28) setFontSize(n);
      }
    } catch {
      // 忽略，使用默认字号
    }
  }, []);

  function changeFontSize(delta: number) {
    setFontSize((prev) => {
      const next = Math.max(14, Math.min(28, prev + delta));
      return next;
    });
  }

  // 字号变化时持久化
  useEffect(() => {
    try {
      localStorage.setItem(ARTICLE_FONT_SIZE_KEY, String(fontSize));
    } catch {
      // 忽略
    }
  }, [fontSize]);

  function changeAutoPronunciation(enabled: boolean) {
    setAutoPronunciation(enabled);
    writeAutoPronunciationToStorage(enabled);
  }

  useEffect(() => {
    function handlePointerUp(e: MouseEvent | TouchEvent) {
      const target = e.target as Node;
      const popupEl = document.querySelector("[data-word-popup]");
      if (popupEl?.contains(target)) return;

      // On mobile, touchend fires before selection is committed.
      // We still clear popup on touchend when there's no selection.
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || !selection.rangeCount) {
        if (!(e.target as HTMLElement)?.closest?.("[data-word-popup]")) {
          setPopup(null);
        }
      }
    }

    const debouncedSelect = debounce(() => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || !selection.rangeCount) {
        return;
      }

      const word = selection.toString().trim();
      if (!word || word.length > VOCAB_WORD_MAX_LENGTH) {
        return;
      }

      const range = selection.getRangeAt(0);
      const isInContent = contentRef.current?.contains(range.commonAncestorContainer) ?? false;
      const isInHeader = headerRef.current?.contains(range.commonAncestorContainer) ?? false;
      if (!isInContent && !isInHeader) {
        return;
      }

      const rect = range.getBoundingClientRect();
      // getBoundingClientRect may return zero rect before selection is fully rendered
      if (rect.width === 0 && rect.height === 0) {
        return;
      }

      // 智能上下文提取：优先整段，其次完整句，最后按词边界截断
      const fullText = range.startContainer.textContent ?? "";
      const startOffset = range.startOffset;
      const wordEndOffset = startOffset + word.length;
      const context = extractReadableContext(fullText, startOffset, wordEndOffset, VOCAB_CONTEXT_MAX_LENGTH);

      // Avoid re-triggering for the same word
      setPopup((prev) => {
        if (prev?.word === word) return prev;
        return {
          word,
          context,
          anchorRect: {
            top: rect.top,
            left: rect.left,
            right: rect.right,
            bottom: rect.bottom,
            width: rect.width,
            height: rect.height,
          },
        };
      });
    }, 300);

    document.addEventListener("mouseup", handlePointerUp);
    document.addEventListener("touchend", handlePointerUp as EventListener);
    document.addEventListener("selectionchange", debouncedSelect);
    return () => {
      document.removeEventListener("mouseup", handlePointerUp);
      document.removeEventListener("touchend", handlePointerUp as EventListener);
      document.removeEventListener("selectionchange", debouncedSelect);
      debouncedSelect.cancel();
    };
  }, []);

  const displayDate = article.publishedAt ?? article.createdAt;
  const paragraphs = article.content.split("\n\n").filter(Boolean);

  return (
    <div className="flex flex-col gap-6 pb-20 md:pb-0 max-w-2xl mx-auto">
      {/* Back button + Settings */}
      <div className="flex items-center justify-between">
        <BackButton
          fallbackHref="/articles"
          label={t("backToList")}
        />
        <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
          <SheetTrigger
            className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "h-8 w-8 shrink-0")}
          >
            <Settings className="h-4 w-4" />
          </SheetTrigger>
          <SheetContent
            side="right"
            showCloseButton={false}
            className="w-[min(100%,20rem)] sm:max-w-sm p-0 flex flex-col gap-0"
          >
            <div className="flex items-center gap-2 px-4 py-4 border-b border-border shrink-0">
              <Settings className="h-5 w-5 text-primary" />
              <span className="font-semibold text-base">{tReader("readerSettings")}</span>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-6">
              {/* Font size */}
              <div className="space-y-3">
                <p className="text-sm font-medium">{tReader("fontSize")}</p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => changeFontSize(-2)}
                    className="h-8 w-9 flex items-center justify-center rounded-md border border-border hover:bg-accent text-xs font-bold text-muted-foreground"
                  >
                    A-
                  </button>
                  <span className="text-sm text-muted-foreground w-8 text-center tabular-nums font-medium">
                    {fontSize}
                  </span>
                  <button
                    type="button"
                    onClick={() => changeFontSize(2)}
                    className="h-8 w-9 flex items-center justify-center rounded-md border border-border hover:bg-accent font-bold text-muted-foreground"
                    style={{ fontSize: "15px" }}
                  >
                    A+
                  </button>
                </div>
              </div>
              {/* Auto pronunciation */}
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{tReader("autoPronunciation")}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {tReader("autoPronunciationHint")}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => changeAutoPronunciation(!autoPronunciation)}
                    className={cn(
                      "shrink-0 flex h-9 w-9 items-center justify-center rounded-md border transition-colors",
                      autoPronunciation
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:bg-accent",
                    )}
                    aria-pressed={autoPronunciation}
                    aria-label={
                      autoPronunciation ? tReader("autoPronunciationOn") : tReader("autoPronunciationOff")
                    }
                  >
                    {autoPronunciation ? (
                      <Volume2 className="h-4 w-4" />
                    ) : (
                      <VolumeX className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Cover image — 右上角眼睛图标可切换显示/隐藏 */}
      {article.coverUrl && (
        <div className="relative aspect-video w-full overflow-hidden rounded-xl">
          {showCover ? (
            <Image
              src={article.coverUrl}
              alt={article.title}
              fill
              sizes="(max-width: 768px) 100vw, 672px"
              className="object-cover"
              unoptimized
              priority
            />
          ) : (
            <div className="absolute inset-0 bg-muted" />
          )}
          <button
            type="button"
            onClick={() => setShowCover((prev) => !prev)}
            className="absolute top-2 right-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-background/80 text-foreground shadow-sm backdrop-blur-sm hover:bg-background/95 transition-colors"
            aria-label={showCover ? "隐藏图片" : "显示图片"}
          >
            {showCover ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      )}

      {/* Article meta — 标题和简介区域，也支持划词弹窗 */}
      <div ref={headerRef} className="flex flex-col gap-2 select-text" style={{ userSelect: "text", WebkitUserSelect: "text" }}>
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={cn(
              "rounded-full px-2.5 py-0.5 text-xs font-semibold",
              levelColor[article.level] ?? levelColor[1]
            )}
          >
            {levelLabel[article.level] ?? "Level 1"}
          </span>
          <span className="text-xs text-muted-foreground">
            {format(displayDate, "yyyy/MM/dd")}
          </span>
          {article.wordCount && (
            <span className="text-xs text-muted-foreground">{article.wordCount} words</span>
          )}
          <a
            href={article.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {t("sourceLink")}
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
        <h1 className="text-xl md:text-2xl font-bold leading-snug text-foreground">
          {article.title}
        </h1>
        {article.description && (
          <p className="text-sm text-muted-foreground leading-relaxed">{article.description}</p>
        )}
      </div>

      <hr className="border-border" />

      {/* Article content — 可选词区域 */}
      <div
        ref={contentRef}
        className="select-text"
        style={{ userSelect: "text", WebkitUserSelect: "text" }}
      >
        <div className="flex flex-col gap-4">
          {paragraphs.map((para, i) => (
            <p
              key={i}
              className="text-foreground tracking-wide"
              style={{ fontSize: `${fontSize}px`, lineHeight: 1.85 }}
            >
              {para}
            </p>
          ))}
        </div>
        <p className="mt-6 text-xs text-muted-foreground/50 select-none">
          {t("selectHint")}
        </p>
      </div>

      {/* Word popup */}
      {popup && (
        <div data-word-popup>
          <WordPopup
            word={popup.word}
            context={popup.context}
            contextCfi=""
            anchorRect={popup.anchorRect}
            onClose={closePopup}
            onSaved={() => {}}
            autoPronunciation={autoPronunciation}
          />
        </div>
      )}
    </div>
  );
}