"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { WordPopup } from "./word-popup";
import { toast } from "sonner";

interface EpubReaderProps {
  bookId: string;
  blobUrl: string;
  initialCfi?: string | null;
  onProgressChange?: (cfi: string, percent: number) => void;
}

interface SelectionInfo {
  word: string;
  context: string;
  cfi: string;
  x: number;
  y: number;
}

export function EpubReader({
  bookId,
  blobUrl,
  initialCfi,
  onProgressChange,
}: EpubReaderProps) {
  const viewerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bookRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renditionRef = useRef<any>(null);
  const [selection, setSelection] = useState<SelectionInfo | null>(null);
  const [fontSize, setFontSize] = useState(16);
  const [percent, setPercent] = useState(0);

  const saveProgress = useCallback(
    async (cfi: string, pct: number) => {
      onProgressChange?.(cfi, pct);
      await fetch(`/api/books/${bookId}/progress`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentCfi: cfi, readingProgress: Math.round(pct) }),
      });
    },
    [bookId, onProgressChange]
  );

  useEffect(() => {
    let mounted = true;

    async function initReader() {
      if (!viewerRef.current) return;

      // 动态导入 epubjs（仅客户端）
      const ePub = (await import("epubjs")).default;
      const book = ePub(blobUrl);
      bookRef.current = book;

      const rendition = book.renderTo(viewerRef.current, {
        width: "100%",
        height: "100%",
        flow: "paginated",
        spread: "none",
      });
      renditionRef.current = rendition;

      // 恢复阅读位置
      if (initialCfi) {
        await rendition.display(initialCfi);
      } else {
        await rendition.display();
      }

      // 字体大小
      rendition.themes.fontSize(`${fontSize}px`);

      // 监听位置变化
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rendition.on("relocated", (location: any) => {
        if (!mounted) return;
        const pct = book.locations.percentageFromCfi(location.start.cfi) * 100;
        setPercent(pct);
        saveProgress(location.start.cfi, pct);
      });

      // 监听文本选中
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rendition.on("selected", (cfiRange: string, contents: any) => {
        if (!mounted) return;
        const selection = contents.window.getSelection();
        if (!selection) return;
        const selectedText = selection.toString().trim();
        if (!selectedText || selectedText.split(/\s+/).length > 5) return; // 只处理单词或短语

        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        const iframeRect = viewerRef.current?.getBoundingClientRect();

        // 获取上下文句子
        const context = selection.anchorNode?.parentElement?.closest("p")?.textContent ?? "";

        setSelection({
          word: selectedText,
          context: context.slice(0, 200),
          cfi: cfiRange,
          x: rect.left + rect.width / 2 - (iframeRect?.left ?? 0),
          y: rect.top - (iframeRect?.top ?? 0),
        });
      });

      // 点击其他地方关闭弹窗
      rendition.on("click", () => {
        if (mounted) setSelection(null);
      });

      // 生成位置信息（用于进度计算）
      await book.locations.generate(1600);
    }

    initReader().catch(console.error);

    return () => {
      mounted = false;
      renditionRef.current?.destroy();
      bookRef.current?.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blobUrl, initialCfi]);

  // 字体大小变化时更新
  useEffect(() => {
    renditionRef.current?.themes.fontSize(`${fontSize}px`);
  }, [fontSize]);

  function prevPage() {
    renditionRef.current?.prev();
  }

  function nextPage() {
    renditionRef.current?.next();
  }

  // 键盘翻页
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") nextPage();
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") prevPage();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="relative flex flex-col h-full">
      {/* 工具栏 */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card text-sm">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFontSize((s) => Math.max(12, s - 2))}
            className="px-2 py-1 rounded hover:bg-accent"
          >
            A-
          </button>
          <span className="text-muted-foreground">{fontSize}px</span>
          <button
            onClick={() => setFontSize((s) => Math.min(24, s + 2))}
            className="px-2 py-1 rounded hover:bg-accent"
          >
            A+
          </button>
        </div>
        <div className="text-muted-foreground">{Math.round(percent)}%</div>
      </div>

      {/* 阅读区域 */}
      <div className="relative flex-1 overflow-hidden">
        <div ref={viewerRef} className="w-full h-full" />

        {/* 单词选中弹窗 */}
        {selection && (
          <WordPopup
            word={selection.word}
            context={selection.context}
            contextCfi={selection.cfi}
            bookId={bookId}
            position={{ x: selection.x, y: selection.y }}
            onClose={() => setSelection(null)}
            onSaved={() => {
              toast.success(`"${selection.word}" 已加入生词本`);
              setSelection(null);
            }}
          />
        )}
      </div>

      {/* 翻页按钮 */}
      <div className="flex items-center justify-between px-6 py-3 border-t border-border bg-card">
        <button
          onClick={prevPage}
          className="px-4 py-2 text-sm rounded-md hover:bg-accent transition-colors"
        >
          ← 上一页
        </button>
        <button
          onClick={nextPage}
          className="px-4 py-2 text-sm rounded-md hover:bg-accent transition-colors"
        >
          下一页 →
        </button>
      </div>
    </div>
  );
}
