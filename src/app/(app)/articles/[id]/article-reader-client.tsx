"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { format } from "date-fns";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { WordPopup, type WordPopupAnchorRect } from "@/components/reader/word-popup";
import { cn } from "@/lib/utils";
import { VOCAB_WORD_MAX_LENGTH } from "@/lib/vocabulary-limits";
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

export function ArticleReaderClient({ article }: { article: Article }) {
  const t = useTranslations("articles");
  const contentRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const [popup, setPopup] = useState<PopupState | null>(null);

  // 阅读时长追踪（页面可见时自动上报到 readingDailyTime）
  useReadingTimeTracker({ enabled: true });

  const closePopup = useCallback(() => {
    setPopup(null);
    window.getSelection()?.removeAllRanges();
  }, []);

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

    function handleSelectionChange() {
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

      const context = range.startContainer.textContent?.trim() ?? "";

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
    }

    document.addEventListener("mouseup", handlePointerUp);
    document.addEventListener("touchend", handlePointerUp as EventListener);
    document.addEventListener("selectionchange", handleSelectionChange);
    return () => {
      document.removeEventListener("mouseup", handlePointerUp);
      document.removeEventListener("touchend", handlePointerUp as EventListener);
      document.removeEventListener("selectionchange", handleSelectionChange);
    };
  }, []);

  const displayDate = article.publishedAt ?? article.createdAt;
  const paragraphs = article.content.split("\n\n").filter(Boolean);

  return (
    <div className="flex flex-col gap-6 pb-20 md:pb-0 max-w-2xl mx-auto">
      {/* Back button */}
      <Link
        href="/articles"
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("backToList")}
      </Link>

      {/* Cover image */}
      {article.coverUrl && (
        <div className="relative aspect-video w-full overflow-hidden rounded-xl">
          <Image
            src={article.coverUrl}
            alt={article.title}
            fill
            sizes="(max-width: 768px) 100vw, 672px"
            className="object-cover"
            unoptimized
            priority
          />
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
              className="text-base md:text-[17px] leading-[1.85] text-foreground tracking-wide"
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
          />
        </div>
      )}
    </div>
  );
}