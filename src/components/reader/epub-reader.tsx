"use client";

import { useEffect, useRef, useState } from "react";
import { WordPopup, type WordPopupAnchorRect } from "./word-popup";
import { clientFetch } from "@/lib/client-fetch";

interface SelectionInfo {
  word: string;
  context: string;
  cfi: string;
  anchorRect: WordPopupAnchorRect;
}

export interface TocItem {
  id?: string;
  href: string;
  label: string;
  subitems?: TocItem[];
}

interface ReaderControls {
  prev: () => void;
  next: () => void;
  displayChapter: (href: string) => void;
}

interface EpubReaderProps {
  bookId: string;
  blobUrl: string;
  initialCfi?: string | null;
  fontSize: number;
  /** chapterPct：当前章节内进度 0–100；无法分页计算时为 null，由上层决定是否回退全书进度 */
  onProgress?: (cfi: string, bookPct: number, chapterName: string, chapterPct: number | null) => void;
  onReady?: (controls: ReaderControls) => void;
  onTocReady?: (toc: TocItem[]) => void;
}

// localStorage key for storing the last-read CFI per book
function cfiKey(bookId: string) {
  return `reader-cfi-${bookId}`;
}

const CONTEXT_SENTENCE_MAX = 320;

/**
 * 生词「原文引用」：取包含选中词的一句（按 .!? 切分），压缩空白；避免整段过长。
 */
function excerptSentenceForVocabulary(paragraph: string, selected: string): string {
  const flat = paragraph.replace(/\s+/g, " ").trim();
  const sel = selected.trim();
  if (!flat) return sel;
  if (!sel) return flat.slice(0, CONTEXT_SENTENCE_MAX);

  const lowerSel = sel.toLowerCase();
  const sentences = flat
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const hit =
    sentences.find((s) => s.toLowerCase().includes(lowerSel)) ??
    sentences.find((s) => {
      const w = sel.split(/\s+/).find(Boolean);
      return w ? s.toLowerCase().includes(w.toLowerCase()) : false;
    });

  let out = (hit ?? sentences[0] ?? flat).trim();
  const firstTok = sel.split(/\s+/).find(Boolean)?.toLowerCase() ?? lowerSel;
  if (firstTok && !out.toLowerCase().includes(firstTok)) {
    out = sel;
  }
  if (out.length > CONTEXT_SENTENCE_MAX) {
    out = `${out.slice(0, CONTEXT_SENTENCE_MAX)}…`;
  }
  return out;
}

export function EpubReader({
  bookId,
  blobUrl,
  initialCfi,
  fontSize,
  onProgress,
  onReady,
  onTocReady,
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

    /** 长按选词（静止超过阈值）不弹出释义，避免与系统选区手柄冲突 */
    const LONG_PRESS_MS = 450;
    const LONG_PRESS_SLOP = 14;
    const longPressByWin = new WeakMap<
      Window,
      { timer: ReturnType<typeof setTimeout> | null; skipNextPopup: boolean; lpStartX: number; lpStartY: number }
    >();
    function longPressState(win: Window) {
      let s = longPressByWin.get(win);
      if (!s) {
        s = { timer: null, skipNextPopup: false, lpStartX: 0, lpStartY: 0 };
        longPressByWin.set(win, s);
      }
      return s;
    }

    // 保存进度到服务端（支持页面卸载场景用 keepalive）
    function saveToServer(cfi: string, pct: number) {
      void clientFetch(`/api/books/${bookId}/progress`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        body: JSON.stringify({ currentCfi: cfi, readingProgress: Math.round(pct) }),
        showErrorToast: false,
      }).catch(() => {});
    }

    async function initReader() {
      if (!viewerRef.current) return;

      const { width, height } = viewerRef.current.getBoundingClientRect();
      const w = Math.floor(width) || 600;
      const h = Math.floor(height) || 800;

      const ePub = (await import("epubjs")).default;
      const book = ePub(blobUrl);
      bookRef.current = book;

      const rendition = book.renderTo(viewerRef.current, {
        width: w,
        height: h,
        flow: "scrolled-doc",
        spread: "none",
      });
      renditionRef.current = rendition;

      onReady?.({
        prev: () => renditionRef.current?.prev(),
        next: () => renditionRef.current?.next(),
        displayChapter: (href: string) => renditionRef.current?.display(href),
      });

      // 在 display() 之前加载导航目录，后续 relocated 中直接同步使用
      // ⚠️ ResizeObserver 必须在 display() 之后再启动，否则首次展示前 resize 会破坏定位。
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let navToc: any[] = [];
      try {
        const nav = await book.loaded.navigation;
        navToc = nav?.toc ?? [];
        if (mounted) onTocReady?.(navToc as TocItem[]);
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

      /** 分页模式下用页码/总页；滚动模式无分页信息时返回 null，上层回退全书进度 */
      function chapterPercentFromDisplayed(displayed: { page?: number; total?: number } | undefined): number | null {
        const total = displayed?.total;
        const page = displayed?.page;
        if (typeof total !== "number" || total < 1 || typeof page !== "number" || page < 1) return null;
        if (total === 1) return 100;
        return ((page - 1) / (total - 1)) * 100;
      }

      // ── 所有事件必须在 display() 之前注册 ──

      // display(initialCfi) 会触发一次 relocated，报告的是页首 CFI（与传入值不同），
      // 这次不能覆盖 localStorage/服务端，否则每次打开都会把位置往前漂移。
      // 后续用户手动翻页才真正保存。
      let isInitialRelocated = true;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rendition.on("relocated", (location: any) => {
        if (!mounted) return;
        const cfi = location.start.cfi;
        const rawBookPct = book.locations.percentageFromCfi(cfi);
        const bookPct = (rawBookPct ?? 0) * 100;
        const chapterPct = chapterPercentFromDisplayed(location.start?.displayed);
        currentCfiRef.current = cfi;
        currentPctRef.current = bookPct;

        const chapterName = findChapterLabel(location.start.href ?? "", navToc);
        onProgress?.(cfi, bookPct, chapterName, chapterPct);

        if (isInitialRelocated) {
          // display(initialCfi) 产生的首次 relocated：只更新 UI，不覆盖位置
          isInitialRelocated = false;
          console.log("[Reader] 初始 relocated（跳过保存）:", cfi);
          return;
        }

        // 用户翻页或滚动导致锚点变化：正常保存
        try {
          localStorage.setItem(cfiKey(bookId), cfi);
          console.log("[Reader] 记录位置 → localStorage:", cfi);
        } catch { /* silent */ }

        console.log("[Reader] 记录位置 → 服务端 PUT:", cfi, `${Math.round(bookPct)}%`);
        saveToServer(cfi, bookPct);
      });

      rendition.on("rendered", (_section: unknown, view: { window: Window }) => {
        const win = view.window;
        if (setupWindows.has(win)) return;
        setupWindows.add(win);

        let startX = 0;
        let startY = 0;
        win.addEventListener("touchstart", (e: TouchEvent) => {
          const t = e.touches[0];
          startX = t.clientX;
          startY = t.clientY;
          const lp = longPressState(win);
          if (lp.timer) clearTimeout(lp.timer);
          lp.skipNextPopup = false;
          lp.lpStartX = t.clientX;
          lp.lpStartY = t.clientY;
          lp.timer = setTimeout(() => {
            lp.skipNextPopup = true;
            lp.timer = null;
          }, LONG_PRESS_MS);
        }, { passive: true });
        win.addEventListener("touchmove", (e: TouchEvent) => {
          const lp = longPressState(win);
          if (!lp.timer || !e.touches[0]) return;
          const t = e.touches[0];
          const dx = Math.abs(t.clientX - lp.lpStartX);
          const dy = Math.abs(t.clientY - lp.lpStartY);
          if (dx > LONG_PRESS_SLOP || dy > LONG_PRESS_SLOP) {
            clearTimeout(lp.timer);
            lp.timer = null;
          }
        }, { passive: true });
        win.addEventListener("touchend", (e: TouchEvent) => {
          const lp = longPressState(win);
          if (lp.timer) {
            clearTimeout(lp.timer);
            lp.timer = null;
          }
          const diffX = startX - e.changedTouches[0].clientX;
          const diffY = startY - e.changedTouches[0].clientY;
          if (Math.abs(diffX) < 70 || Math.abs(diffX) < Math.abs(diffY) * 1.5) return;
          if (diffX > 0) renditionRef.current?.next();
          else renditionRef.current?.prev();
        }, { passive: true });
      });

      /** 合并多行选区为单一包围盒（iframe 内坐标） */
      function unionSelectionRects(sel: Selection): DOMRect | null {
        if (sel.rangeCount === 0) return null;
        let u: DOMRect | null = null;
        for (let i = 0; i < sel.rangeCount; i++) {
          const r = sel.getRangeAt(i).getBoundingClientRect();
          if (r.width === 0 && r.height === 0) continue;
          if (!u) {
            u = new DOMRect(r.left, r.top, r.width, r.height);
          } else {
            const left = Math.min(u.left, r.left);
            const top = Math.min(u.top, r.top);
            const right = Math.max(u.right, r.right);
            const bottom = Math.max(u.bottom, r.bottom);
            u = new DOMRect(left, top, right - left, bottom - top);
          }
        }
        return u;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rendition.on("selected", (cfiRange: string, contents: any) => {
        if (!mounted) return;
        lastSelectedAt = Date.now();
        const win = contents.window as Window;
        const sel = win.getSelection();
        if (!sel) return;
        const text = sel.toString().trim();
        if (!text || text.length > 200) return;
        const local = unionSelectionRects(sel);
        const iframe = win.frameElement as HTMLIFrameElement | null;
        if (!local || !iframe) return;
        const ir = iframe.getBoundingClientRect();
        const anchorRect: WordPopupAnchorRect = {
          top: local.top + ir.top,
          left: local.left + ir.left,
          right: local.right + ir.left,
          bottom: local.bottom + ir.top,
          width: local.width,
          height: local.height,
        };
        const lp = longPressState(win);
        if (lp.skipNextPopup) {
          lp.skipNextPopup = false;
          return;
        }
        const raw =
          sel.anchorNode?.parentElement?.closest("p")?.textContent?.trim() ??
          sel.anchorNode?.parentElement?.textContent?.trim() ??
          "";
        const context = excerptSentenceForVocabulary(raw, text);
        setSelection({ word: text, context, cfi: cfiRange, anchorRect });
      });

      rendition.on("click", () => {
        if (!mounted) return;
        if (Date.now() - lastSelectedAt < 300) return;
        setSelection(null);
      });

      // 滚动模式：在内容注入前注册，首节也会生效（减轻 Chromium scroll anchoring 回弹）
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rendition.hooks.content.register((contents: any) => {
        const doc = contents?.document as Document | undefined;
        if (!doc) return;
        doc.documentElement.style.setProperty("overflow-anchor", "none", "important");
        doc.body.style.setProperty("overflow-anchor", "none", "important");
      });

      // 必须在 display 之前设置字号：先 display 再改字体会整体重排，滚动像素不变但视口顶端的正文会「漂移」，
      // scrolledLocation() 会误报成别的段落 CFI（例如 106→74），刷新后看起来「没回到上次位置」。
      rendition.themes.fontSize(`${fontSize}px`);

      // ── 事件绑定完毕后再 display ──
      if (initialCfi) {
        console.log("[Reader] 回显位置 → display(initialCfi):", initialCfi);
        await rendition.display(initialCfi);
      } else {
        console.log("[Reader] 回显位置 → display() 从头开始（无 initialCfi）");
        await rendition.display();
      }
      if (!mounted) return;

      book.locations.generate(1600).catch(() => {});

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const stage = ((rendition as any).manager?.container ?? null) as HTMLElement | null;
      stage?.style.setProperty("overflow-anchor", "none");

      // ── display() 完成后再启动 ResizeObserver ──
      resizeObserver = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (!entry || !renditionRef.current) return;
        const { width: rw, height: rh } = entry.contentRect;
        if (rw > 0 && rh > 0) {
          renditionRef.current.resize(Math.floor(rw), Math.floor(rh));
        }
      });
      resizeObserver.observe(viewerRef.current);
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
      // 滚动模式：上下键留给正文内滚动，仅用左右键切换 spine 片段
      if (e.key === "ArrowRight") renditionRef.current?.next();
      if (e.key === "ArrowLeft") renditionRef.current?.prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="relative h-full w-full min-h-0">
      <div
        ref={viewerRef}
        className="h-full w-full min-h-0 overflow-hidden [overflow-anchor:none]"
      />
      {selection && (
        <WordPopup
          word={selection.word}
          context={selection.context}
          contextCfi={selection.cfi}
          bookId={bookId}
          anchorRect={selection.anchorRect}
          onClose={() => setSelection(null)}
          onSaved={() => setSelection(null)}
        />
      )}
    </div>
  );
}
