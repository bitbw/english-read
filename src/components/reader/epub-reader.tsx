"use client";

import { useEffect, useRef, useState } from "react";
import ePub, {
  type Book,
  type Contents,
  type Location,
  type NavItem,
  type Rendition,
} from "epubjs";
import { WordPopup, type WordPopupAnchorRect } from "./word-popup";
import { clientFetch } from "@/lib/client-fetch";
import { debounce } from "@/lib/debounce";

interface SelectionInfo {
  word: string;
  context: string;
  cfi: string;
  anchorRect: WordPopupAnchorRect;
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
  /** bookPct：0–100，`(spineIndex + page/total) / spine.length`；chapterPct：当前章内分页进度。 */
  onProgress?: (cfi: string, bookPct: number, chapterName: string, chapterPct: number) => void;
  onReady?: (controls: ReaderControls) => void;
  onTocReady?: (toc: NavItem[]) => void;
}

function cfiKey(bookId: string) {
  return `reader-cfi-${bookId}`;
}

const CONTEXT_SENTENCE_MAX = 320;

const RELOCATED_DEBOUNCE_MS = 300;
const SELECTED_DEBOUNCE_MS = 200;

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

/** epub 运行时 `spine.length` 有值，类型定义未写出 */
function spineLength(book: Book): number {
  return (book.spine as Book["spine"] & { length: number }).length;
}

/** 全书进度 0–100：`(index + page/total) / spine.length` */
function wholeBookPctFromSpine(book: Book, location: Location): number {
  const n = spineLength(book);
  const { index } = location.start;
  const { page, total } = location.start.displayed;
  const p = (index + page / total) / n;
  return Math.min(100, Math.max(0, p * 100));
}

/** 当前 spine 片段内分页进度 0–100（见 `DisplayedLocation.displayed`） */
function chapterPctFromDisplayed(d: Location["start"]["displayed"]): number {
  if (d.total === 1) return 100;
  return ((d.page - 1) / (d.total - 1)) * 100;
}

/** 在嵌套 `navToc` 中按当前节 `href`（去 #）后缀匹配目录项 */
function chapterLabelFromNavToc(items: NavItem[], href: string): string | undefined {
  const path = href.split("#")[0] ?? "";
  if (!path) return undefined;
  for (const item of items) {
    const itemPath = (item.href ?? "").split("#")[0];
    if (itemPath && path.endsWith(itemPath)) {
      return item.label;
    }
    if (item.subitems?.length) {
      const nested = chapterLabelFromNavToc(item.subitems, href);
      if (nested) return nested;
    }
  }
  return undefined;
}

function chapterDisplayName(location: Location, navToc: NavItem[]): string {
  const label = chapterLabelFromNavToc(navToc, location.start.href);
  return (label?.trim() || `第 ${location.start.index + 1} 章`);
}

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
  const bookRef = useRef<Book | null>(null);
  const renditionRef = useRef<Rendition | null>(null);
  const currentCfiRef = useRef<string>("");
  const currentPctRef = useRef<number>(0);
  const navTocRef = useRef<NavItem[]>([]);
  const [selection, setSelection] = useState<SelectionInfo | null>(null);
  /** 拉取 blobUrl、解析 EPUB、首屏 display 完成前 */
  const [bookLoading, setBookLoading] = useState(true);

  useEffect(() => {
    currentCfiRef.current = initialCfi?.trim() ? initialCfi : "";
    currentPctRef.current = 0;
    setBookLoading(true);

    let mounted = true;
    let lastSelectedAt = 0;

    const debouncedRelocated = debounce((location: Location) => {
      console.log("[BOWEN_LOG] 🚀 ~~ debouncedRelocated ~~ location:", location);
      if (!mounted) return;
      const book = bookRef.current;
      if (!book) return;

      const cfi = location.start.cfi;
      const bookPct = wholeBookPctFromSpine(book, location);
      const chapterName = chapterDisplayName(location, navTocRef.current);
      const chapterPct = chapterPctFromDisplayed(location.start.displayed);

      currentCfiRef.current = cfi;
      currentPctRef.current = bookPct;

      onProgress?.(cfi, bookPct, chapterName, chapterPct);

      try {
        localStorage.setItem(cfiKey(bookId), cfi);
      } catch {
        /* silent */
      }

      persistProgressToServer();
    }, RELOCATED_DEBOUNCE_MS);

    const debouncedSelected = debounce((cfiRange: string, contents: Contents) => {
      console.log("[BOWEN_LOG] 🚀 ~~ debouncedSelected ~~ cfiRange:", cfiRange);
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
      const raw =
        sel.anchorNode?.parentElement?.closest("p")?.textContent?.trim() ??
        sel.anchorNode?.parentElement?.textContent?.trim() ??
        "";
      const context = excerptSentenceForVocabulary(raw, text);
      setSelection({ word: text, context, cfi: cfiRange, anchorRect });
    }, SELECTED_DEBOUNCE_MS);

    function saveToServer(cfi: string, pct: number) {
      void clientFetch(`/api/books/${bookId}/progress`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        body: JSON.stringify({ currentCfi: cfi, readingProgress: Math.round(pct) }),
        showErrorToast: false,
      }).catch(() => {});
    }

    function persistProgressToServer() {
      if (!currentCfiRef.current) return;
      saveToServer(currentCfiRef.current, currentPctRef.current);
    }

    function onWindowResize() {
      if (!viewerRef.current || !renditionRef.current) return;
      const vr = viewerRef.current.getBoundingClientRect();
      const rw = Math.floor(vr.width) || 600;
      const rh = Math.floor(vr.height) || 800;
      renditionRef.current.resize(rw, rh);
    }

    async function initReader() {
      if (!viewerRef.current) {
        setBookLoading(false);
        return;
      }

      const vr = viewerRef.current.getBoundingClientRect();
      const w = Math.floor(vr.width) || 600;
      const h = Math.floor(vr.height) || 800;

      const book = ePub(blobUrl);
      bookRef.current = book;

      try {
        await book.ready;
      } catch {
        if (mounted) setBookLoading(false);
        return;
      }
      if (!mounted) return;

      const navToc: NavItem[] = book.navigation?.toc ?? [];
      navTocRef.current = navToc;
      onTocReady?.(navToc);

      const rendition = book.renderTo(viewerRef.current, {
        width: w,
        height: h,
        flow: "paginated",
        spread: "auto",
      });
      renditionRef.current = rendition;

      onReady?.({
        prev: () => renditionRef.current?.prev(),
        next: () => renditionRef.current?.next(),
        displayChapter: (href: string) => renditionRef.current?.display(href),
      });

      // 视口锚点变化：更新 CFI、全书/本章进度、本地与服务端持久化
      rendition.on("relocated", debouncedRelocated);

      rendition.on("selected", debouncedSelected);

      rendition.on("click", () => {
        if (!mounted) return;
        if (Date.now() - lastSelectedAt < 300) return;
        setSelection(null);
      });

      rendition.themes.fontSize(`${fontSize}px`);

      const startCfi = initialCfi?.trim();
      if (startCfi) {
        await rendition.display(startCfi);
      } else {
        await rendition.display();
      }
      if (!mounted) return;

      setBookLoading(false);
      window.addEventListener("resize", onWindowResize);
    }

    initReader().catch((err) => {
      console.error(err);
      setBookLoading(false);
    });

    return () => {
      mounted = false;
      debouncedRelocated.cancel();
      debouncedSelected.cancel();
      window.removeEventListener("resize", onWindowResize);
      persistProgressToServer();
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
      if (e.key === "ArrowRight") renditionRef.current?.next();
      if (e.key === "ArrowLeft") renditionRef.current?.prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="relative h-full w-full min-h-0">
      <div ref={viewerRef} className="h-full w-full min-h-0 overflow-hidden [overflow-anchor:none]" />
      {bookLoading ? (
        <div
          className="absolute inset-0 z-10 flex items-center justify-center bg-background/80"
          role="status"
          aria-live="polite"
        >
          <p className="text-sm text-muted-foreground">加载书籍中…</p>
        </div>
      ) : null}
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
