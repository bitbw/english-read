"use client";

import { useEffect, useRef, useState } from "react";
import { WordPopup } from "./word-popup";

interface SelectionInfo {
  word: string;
  context: string;
  cfi: string;
}

interface ReaderControls {
  prev: () => void;
  next: () => void;
}

interface EpubReaderProps {
  bookId: string;
  blobUrl: string;
  initialCfi?: string | null;
  fontSize: number;
  onProgress?: (cfi: string, pct: number, chapterName: string) => void;
  onReady?: (controls: ReaderControls) => void;
}

export function EpubReader({
  bookId,
  blobUrl,
  initialCfi,
  fontSize,
  onProgress,
  onReady,
}: EpubReaderProps) {
  const viewerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bookRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renditionRef = useRef<any>(null);
  const currentCfiRef = useRef<string>("");
  const currentPctRef = useRef<number>(0);
  const [selection, setSelection] = useState<SelectionInfo | null>(null);

  useEffect(() => {
    let mounted = true;
    let resizeObserver: ResizeObserver | null = null;
    let lastSelectedAt = 0;
    // WeakSet 防止同一 iframe window 重复注册触摸监听
    const setupWindows = new WeakSet<Window>();

    async function initReader() {
      if (!viewerRef.current) return;

      const { width, height } = viewerRef.current.getBoundingClientRect();
      const ePub = (await import("epubjs")).default;
      const book = ePub(blobUrl);
      bookRef.current = book;

      const rendition = book.renderTo(viewerRef.current, {
        width: Math.floor(width) || 600,
        height: Math.floor(height) || 800,
        flow: "paginated",
        spread: "none",
      });
      renditionRef.current = rendition;

      // 通知父组件 prev/next 控制方法
      onReady?.({
        prev: () => renditionRef.current?.prev(),
        next: () => renditionRef.current?.next(),
      });

      // 容器尺寸变化时重算列布局
      resizeObserver = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (!entry || !renditionRef.current) return;
        const { width: w, height: h } = entry.contentRect;
        if (w > 0 && h > 0) {
          renditionRef.current.resize(Math.floor(w), Math.floor(h));
        }
      });
      resizeObserver.observe(viewerRef.current);

      // ── 所有事件必须在 display() 之前注册，否则初次 relocated 会丢失 ──

      // 进度追踪 + 章节名
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rendition.on("relocated", async (location: any) => {
        if (!mounted) return;
        currentCfiRef.current = location.start.cfi;
        const pct = book.locations.percentageFromCfi(location.start.cfi) * 100;
        currentPctRef.current = pct;

        // 查找当前章节名
        let chapterName = "";
        try {
          const nav = await book.loaded.navigation;
          const href = location.start.href ?? "";
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const findLabel = (items: any[]): string => {
            for (const item of items) {
              const itemHref = (item.href ?? "").split("#")[0];
              if (itemHref && href.endsWith(itemHref)) return item.label?.trim() ?? "";
              if (item.subitems?.length) {
                const found = findLabel(item.subitems);
                if (found) return found;
              }
            }
            return "";
          };
          chapterName = findLabel(nav.toc);
        } catch { /* silent */ }

        onProgress?.(location.start.cfi, pct, chapterName);

        // 同步保存到服务端
        fetch(`/api/books/${bookId}/progress`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ currentCfi: location.start.cfi, readingProgress: Math.round(pct) }),
        }).catch(() => {});
      });

      // 每次 section 渲染时为 iframe 注册水平滑动翻章
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rendition.on("rendered", (_section: any, view: any) => {
        const win: Window = view.window;
        if (setupWindows.has(win)) return;
        setupWindows.add(win);

        let startX = 0;
        let startY = 0;
        win.addEventListener("touchstart", (e: TouchEvent) => {
          startX = e.touches[0].clientX;
          startY = e.touches[0].clientY;
        }, { passive: true });
        win.addEventListener("touchend", (e: TouchEvent) => {
          const diffX = startX - e.changedTouches[0].clientX;
          const diffY = startY - e.changedTouches[0].clientY;
          // 水平滑动距离 ≥ 70px，且明显大于垂直方向，才触发翻章
          if (Math.abs(diffX) < 70 || Math.abs(diffX) < Math.abs(diffY) * 1.5) return;
          if (diffX > 0) renditionRef.current?.next();
          else renditionRef.current?.prev();
        }, { passive: true });
      });

      // 文字选中 → 弹出 WordPopup（支持多词/句子，最多 200 字符）
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rendition.on("selected", (cfiRange: string, contents: any) => {
        if (!mounted) return;
        lastSelectedAt = Date.now();
        const sel = contents.window.getSelection();
        if (!sel) return;
        const text = sel.toString().trim();
        if (!text || text.length > 200) return;

        const context = sel.anchorNode?.parentElement?.closest("p")?.textContent ?? "";
        setSelection({
          word: text,
          context: context.slice(0, 300),
          cfi: cfiRange,
        });
      });

      // 点击空白处关闭弹窗（选词后 300ms 内的 click 忽略，防止弹窗瞬间消失）
      rendition.on("click", () => {
        if (!mounted) return;
        if (Date.now() - lastSelectedAt < 300) return;
        setSelection(null);
      });

      // ── 事件绑定完毕后再 display ──
      if (initialCfi) {
        await rendition.display(initialCfi);
      } else {
        await rendition.display();
      }

      rendition.themes.fontSize(`${fontSize}px`);

      // 异步生成位置锚点（不阻塞渲染）
      book.locations.generate(1600).catch(() => {});
    }

    initReader().catch(console.error);

    // 切换标签页/最小化/跳转其他页时，用 sendBeacon 可靠保存当前位置
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden" && currentCfiRef.current) {
        navigator.sendBeacon(
          `/api/books/${bookId}/progress`,
          new Blob(
            [JSON.stringify({ currentCfi: currentCfiRef.current, readingProgress: Math.round(currentPctRef.current) })],
            { type: "application/json" }
          )
        );
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      mounted = false;
      resizeObserver?.disconnect();
      renditionRef.current?.destroy();
      bookRef.current?.destroy();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blobUrl, initialCfi, bookId]);

  // 字体大小变化时实时更新
  useEffect(() => {
    renditionRef.current?.themes.fontSize(`${fontSize}px`);
  }, [fontSize]);

  // 键盘翻章
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") renditionRef.current?.next();
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") renditionRef.current?.prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="relative w-full h-full">
      <div ref={viewerRef} className="w-full h-full" />

      {selection && (
        <WordPopup
          word={selection.word}
          context={selection.context}
          contextCfi={selection.cfi}
          bookId={bookId}
          onClose={() => setSelection(null)}
          onSaved={() => setSelection(null)}
        />
      )}
    </div>
  );
}
