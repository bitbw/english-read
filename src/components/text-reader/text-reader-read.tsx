"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Volume2, VolumeX, PencilLine } from "lucide-react";
import { useTranslations } from "next-intl";
import { WordPopup } from "@/components/reader/word-popup";
import { useWordSelectionPopup } from "@/hooks/use-word-selection-popup";
import {
  readAutoPronunciationFromStorage,
  writeAutoPronunciationToStorage,
} from "@/lib/reader-auto-pronunciation";
import { sanitizeRichText } from "./rich-text";

const TEXT_FONT_SIZE_KEY = "english-read-text-reader-font-size";

interface TextReaderReadProps {
  text: string;
  onEdit: () => void;
}

export function TextReaderRead({ text, onEdit }: TextReaderReadProps) {
  const t = useTranslations("textreader");
  const contentRef = useRef<HTMLDivElement>(null);
  const { popup, closePopup } = useWordSelectionPopup([contentRef]);
  const [fontSize, setFontSize] = useState(17);
  const [autoPronunciation, setAutoPronunciation] = useState(readAutoPronunciationFromStorage);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(TEXT_FONT_SIZE_KEY);
      if (saved) {
        const n = parseInt(saved, 10);
        if (n >= 14 && n <= 28) setFontSize(n);
      }
    } catch {
      // 忽略，使用默认字号
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(TEXT_FONT_SIZE_KEY, String(fontSize));
    } catch {
      // 忽略
    }
  }, [fontSize]);

  function changeFontSize(delta: number) {
    setFontSize((prev) => Math.max(14, Math.min(28, prev + delta)));
  }

  const content = sanitizeRichText(text);

  return (
    <div className="flex flex-col gap-6">
      {/* 工具栏：编辑原文 + 字号 + 自动发音 */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="outline" size="sm" onClick={onEdit} className="gap-2">
          <PencilLine className="h-4 w-4" />
          {t("editOriginal")}
        </Button>
        <div className="flex items-center gap-1">
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
          <button
            type="button"
            onClick={() => {
              const next = !autoPronunciation;
              setAutoPronunciation(next);
              writeAutoPronunciationToStorage(next);
            }}
            className="ml-1 h-8 w-9 flex items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-accent transition-colors"
            aria-pressed={autoPronunciation}
            title={autoPronunciation ? t("autoPronunciationOn") : t("autoPronunciationOff")}
          >
            {autoPronunciation ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* 内容区：可划词 */}
      <div
        ref={contentRef}
        className="select-text"
        style={{ userSelect: "text", WebkitUserSelect: "text" }}
      >
        <div
          className="text-foreground tracking-wide [&_p]:my-4 [&_h1]:my-5 [&_h1]:text-3xl [&_h1]:font-bold [&_h2]:my-4 [&_h2]:text-2xl [&_h2]:font-bold [&_h3]:my-3 [&_h3]:text-xl [&_h3]:font-semibold [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1 [&_blockquote]:my-4 [&_blockquote]:border-l-2 [&_blockquote]:border-muted-foreground/40 [&_blockquote]:pl-4 [&_a]:text-primary [&_a]:underline [&_table]:my-4 [&_table]:border-collapse [&_td]:border [&_td]:border-border [&_td]:p-2 [&_th]:border [&_th]:border-border [&_th]:p-2"
          style={{ fontSize: `${fontSize}px`, lineHeight: 1.85, userSelect: "text", WebkitUserSelect: "text" }}
          dangerouslySetInnerHTML={{ __html: content }}
        />
        <p className="mt-6 text-xs text-muted-foreground/50 select-none">
          {t("selectHint")}
        </p>
      </div>

      {/* 单词弹窗 */}
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
