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

// localStorage key for storing the last-read CFI per book
function cfiKey(bookId: string) {
  return `reader-cfi-${bookId}`;
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
    const setupWindows = new WeakSet<Window>();

    // 保存进度到服务端（支持页面卸载场景用 keepalive）
    function saveToServer(cfi: string, pct: number) {
      fetch(`/api/books/${bookId}/progress`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        keepalive: true, // 页面卸载/组件卸载时请求依然会完成
        body: JSON.stringify({ currentCfi: cfi, readingProgress: Math.round(pct) }),
      }).catch(() => {});
    }

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

      onReady?.({
        prev: () => renditionRef.current?.prev(),
        next: () => renditionRef.current?.next(),
      });

      resizeObserver = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (!entry || !renditionRef.current) return;
        const { width: w, height: h } = entry.contentRect;
        if (w > 0 && h > 0) {
          renditionRef.current.resize(Math.floor(w), Math.floor(h));
        }
      });
      resizeObserver.observe(viewerRef.current);

      // 在 display() 之前加载导航目录，后续 relocated 中直接同步使用
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let navToc: any[] = [];
      try {
        const nav = await book.loaded.navigation;
        navToc = nav?.toc ?? [];
      } catch { /* silent */ }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      function findChapterLabel(href: string, items: any[]): string {
        for (const item of items) {
          const itemHref = (item.href ?? "").split("#")[0];
          if (itemHref && href.endsWith(itemHref)) return item.label?.trim() ?? "";
          if (item.subitems?.length) {
            const found = findChapterLabel(href, item.subitems);
            if (found) return found;
          }
        }
        return "";
      }

      // ── 所有事件必须在 display() 之前注册 ──

      // relocated 必须是同步函数，不能有 await，否则 fetch 可能不被执行
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rendition.on("relocated", (location: any) => {
        if (!mounted) return;
        const cfi = location.start.cfi;
        const pct = book.locations.percentageFromCfi(cfi) * 100;
        currentCfiRef.current = cfi;
        currentPctRef.current = pct;

        // 立即写入 localStorage，不依赖网络
        try {
          localStorage.setItem(cfiKey(bookId), cfi);
          console.log("[Reader] 记录位置 → localStorage:", cfi);
        } catch { /* silent */ }

        const chapterName = findChapterLabel(location.start.href ?? "", navToc);
        onProgress?.(cfi, pct, chapterName);

        console.log("[Reader] 记录位置 → 服务端 PUT:", cfi, `${Math.round(pct)}%`);
        saveToServer(cfi, pct);
      });

      rendition.on("rendered", (_section: unknown, view: { window: Window }) => {
        const win = view.window;
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
          if (Math.abs(diffX) < 70 || Math.abs(diffX) < Math.abs(diffY) * 1.5) return;
          if (diffX > 0) renditionRef.current?.next();
          else renditionRef.current?.prev();
        }, { passive: true });
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rendition.on("selected", (cfiRange: string, contents: any) => {
        if (!mounted) return;
        lastSelectedAt = Date.now();
        const sel = contents.window.getSelection();
        if (!sel) return;
        const text = sel.toString().trim();
        if (!text || text.length > 200) return;
        const context = sel.anchorNode?.parentElement?.closest("p")?.textContent ?? "";
        setSelection({ word: text, context: context.slice(0, 300), cfi: cfiRange });
      });

      rendition.on("click", () => {
        if (!mounted) return;
        if (Date.now() - lastSelectedAt < 300) return;
        setSelection(null);
      });

      // ── 事件绑定完毕后再 display ──
      if (initialCfi) {
        console.log("[Reader] 回显位置 → display(initialCfi):", initialCfi);
        await rendition.display(initialCfi);
      } else {
        console.log("[Reader] 回显位置 → display() 从头开始（无 initialCfi）");
        await rendition.display();
      }

      rendition.themes.fontSize(`${fontSize}px`);
      book.locations.generate(1600).catch(() => {});
    }

    initReader().catch(console.error);

    return () => {
      mounted = false;
      resizeObserver?.disconnect();
      // 组件卸载（Next.js 客户端跳转）时再保存一次，keepalive 确保请求完成
      if (currentCfiRef.current) {
        console.log("[Reader] 组件卸载，记录位置 → 服务端 PUT (keepalive):", currentCfiRef.current);
        saveToServer(currentCfiRef.current, currentPctRef.current);
      }
      renditionRef.current?.destroy();
      bookRef.current?.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blobUrl, initialCfi, bookId]);

  useEffect(() => {
    renditionRef.current?.themes.fontSize(`${fontSize}px`);
  }, [fontSize]);

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
