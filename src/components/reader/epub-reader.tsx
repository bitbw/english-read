"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
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
import { readerDebugLog } from "@/lib/reader-debug";

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
  onProgress?: (
    cfi: string,
    bookPct: number,
    chapterName: string,
    chapterPct: number
  ) => void;
  onReady?: (controls: ReaderControls) => void;
  onTocReady?: (toc: NavItem[]) => void;
}

const CONTEXT_SENTENCE_MAX = 320;

const RELOCATED_DEBOUNCE_MS = 300;
const SELECTED_DEBOUNCE_MS = 200;

/** 横向滑动超过此距离（px）且以水平为主时触发翻页（略大以减少误触）。 */
const SWIPE_PAGE_MIN_PX = 112;
/** 滑动时允许的最大纵向偏移（px），超过则视为滚动而非翻页。 */
const SWIPE_MAX_VERTICAL_PX = 96;
// /** 从 touchstart 到选区出现超过此时长视为长按选词：不打开查词弹层（在防抖前判定，不含防抖延迟）。 */
// const LONG_PRESS_NO_POPUP_MS = 450;

/**
 * 阅读器外壳样式。勿对宿主设 `-webkit-touch-callout: none`：在 iOS/WebKit 上会抑制长按呼出的
 * 选词/复制菜单，表现为「划不了词」。正文在 iframe 内，该属性也解决不了 iframe 内冲突。
 */
const VIEWER_HOST_STYLE: CSSProperties & { WebkitUserDrag?: "none" } = {
  WebkitUserDrag: "none",
  userSelect: "text",
};

/** 从所在段落中截取一句（或整段截断）作为划词收藏时的「上下文」展示文案。 */
function excerptSentenceForVocabulary(
  paragraph: string,
  selected: string
): string {
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
function chapterLabelFromNavToc(
  items: NavItem[],
  href: string
): string | undefined {
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

/** 当前位置的目录标题；目录无匹配时用「第 N 章」（N 为 spine 索引 + 1）。 */
function chapterDisplayName(location: Location, navToc: NavItem[]): string {
  const label = chapterLabelFromNavToc(navToc, location.start.href);
  return label?.trim() || `第 ${location.start.index + 1} 章`;
}

/** 将选区内多个 Range 的包围矩形合并为一个，用于弹层锚定。 */
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

/**
 * iOS WebKit 上有时 `getRange(i).getBoundingClientRect()` 全为 0，但 `getClientRects()` 或
 * 合并后的 Range 仍有有效矩形；用于避免划词成功却因锚点为 null 而不弹窗。
 */
function selectionAnchorRectFallback(sel: Selection): DOMRect | null {
  if (sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0);
  if (range.collapsed) return null;
  const rects = range.getClientRects();
  let u: DOMRect | null = null;
  for (let i = 0; i < rects.length; i++) {
    const r = rects[i];
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
  if (u) return u;
  const br = range.getBoundingClientRect();
  if (br.width > 0 || br.height > 0) return br;
  return null;
}

/**
 * 回显上次阅读位置：先立即 `display` 一次，再在双 `requestAnimationFrame` 后 `display` 一次，
 * 等布局与 iframe 稳定后再对齐，避免仅单次 display 时的分页错位。
 */
async function displayInitialReadingPosition(
  rendition: Rendition,
  initialCfi: string | null | undefined,
  isMounted: () => boolean
): Promise<void> {
  const startCfi = initialCfi?.trim();
  if (startCfi) {
    await rendition.display(startCfi);
  } else {
    await rendition.display();
  }

  requestAnimationFrame(() => {
    requestAnimationFrame(async () => {
      if (!isMounted()) return;
      if (startCfi) {
        await rendition.display(startCfi);
      } else {
        await rendition.display();
      }
    });
  });
}

/** EPUB 阅读器：分页渲染、进度与划词；epubjs 仅在客户端加载。 */
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

  /** 创建/销毁 epubjs 实例：换书、换 blob、或父组件传入新的 initialCfi 起点时整段重跑。 */
  useEffect(() => {
    currentCfiRef.current = initialCfi?.trim() ? initialCfi : "";
    currentPctRef.current = 0;
    setBookLoading(true);

    let mounted = true;
    /** 最近一次划词完成时间，用于区分「点击关闭弹层」与「划词后误触 click」。 */
    let lastSelectedAt = 0;
    // /** iframe 内最近一次 touchstart 时间（用于长按不弹窗，仅触摸）。 */
    // const touchStartedAtByWin = new WeakMap<Window, number>();
    /** 最近一次滑动翻页时间，避免翻页手势仍打开查词层。 */
    const swipeNavAtByWin = new WeakMap<Window, number>();
    const touchSwipeAttached = new WeakSet<Window>();

    /** 锚点变化：进度 UI、服务端 PUT（整段防抖，见 RELOCATED_DEBOUNCE_MS）。 */
    const debouncedRelocated = debounce((location: Location) => {
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
      readerDebugLog("relocated", {
        cfi,
        bookPct,
        chapterName,
        chapterPct,
      });

      persistProgressToServer();
    }, RELOCATED_DEBOUNCE_MS);

    /** 划词结束：计算锚点矩形与摘录上下文，打开查词弹层（防抖见 SELECTED_DEBOUNCE_MS）。 */
    const debouncedSelected = debounce(
      (cfiRange: string, contents: Contents) => {
        if (!mounted) return;
        const win = contents.window as Window;
        const swipeAt = swipeNavAtByWin.get(win);
        if (swipeAt !== undefined && Date.now() - swipeAt < 900) {
          return;
        }
        lastSelectedAt = Date.now();
        const sel = win.getSelection();
        if (!sel) return;
        const text = sel.toString().trim();
        if (!text || text.length > 200) return;
        let local = unionSelectionRects(sel);
        if (!local) {
          local = selectionAnchorRectFallback(sel);
        }
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
        readerDebugLog("selected", {
          cfiRange,
          wordLen: text.length,
          word: text.length > 64 ? `${text.slice(0, 64)}…` : text,
        });
        setSelection({ word: text, context, cfi: cfiRange, anchorRect });
      },
      SELECTED_DEBOUNCE_MS
    );

    // /**
    //  * 在防抖前判定长按：仅跳过查词弹层。
    //  * 已暂时关闭：长按也应允许打开查词弹层（见 debouncedSelected）。
    //  */
    // function handleSelected(cfiRange: string, contents: Contents) {
    //   if (!mounted) return;
    //   const win = contents.window as Window;
    //   const t0 = touchStartedAtByWin.get(win);
    //   if (t0 !== undefined && Date.now() - t0 >= LONG_PRESS_NO_POPUP_MS) {
    //     return;
    //   }
    //   debouncedSelected(cfiRange, contents);
    // }

    /** 将指定 CFI 与全书进度百分比写入服务端。 */
    function saveToServer(cfi: string, pct: number) {
      void clientFetch(`/api/books/${bookId}/progress`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        body: JSON.stringify({
          currentCfi: cfi,
          readingProgress: Math.round(pct),
        }),
        showErrorToast: false,
      }).catch(() => {});
    }

    /** 使用 ref 中当前锚点与进度上报（供 relocated 与卸载清理调用）。 */
    function persistProgressToServer() {
      if (!currentCfiRef.current) return;
      saveToServer(currentCfiRef.current, currentPctRef.current);
    }

    /** 窗口尺寸变化时同步 rendition 视口，避免分页错位。 */
    function onWindowResize() {
      if (!viewerRef.current || !renditionRef.current) return;
      const vr = viewerRef.current.getBoundingClientRect();
      const rw = Math.floor(vr.width) || 600;
      const rh = Math.floor(vr.height) || 800;
      renditionRef.current.resize(rw, rh);
    }

    /** 创建 Book / Rendition，绑定事件后首屏 display，并结束 loading。 */
    async function initReader() {
      // 无挂载容器则无法渲染，直接结束 loading
      if (!viewerRef.current) {
        setBookLoading(false);
        return;
      }

      // 分页模式依赖具体像素宽高，不用百分比
      const vr = viewerRef.current.getBoundingClientRect();
      const w = Math.floor(vr.width) || 600;
      const h = Math.floor(vr.height) || 800;

      // 从 Blob URL 解析 EPUB 包
      const book = ePub(blobUrl);
      bookRef.current = book;

      try {
        await book.ready;
      } catch {
        if (mounted) setBookLoading(false);
        return;
      }
      if (!mounted) return;

      // 目录供章名展示与 navTocRef（debounced relocated 使用）
      const navToc: NavItem[] = book.navigation?.toc ?? [];
      navTocRef.current = navToc;
      onTocReady?.(navToc);

      // 在容器内建立分页版面
      const rendition = book.renderTo(viewerRef.current, {
        width: w,
        height: h,
        flow: "paginated",
        spread: "auto",
      });
      renditionRef.current = rendition;

      // 供顶栏/父组件：上一页、下一页、按 href 跳转
      onReady?.({
        prev: () => renditionRef.current?.prev(),
        next: () => renditionRef.current?.next(),
        displayChapter: (href: string) => renditionRef.current?.display(href),
      });

      // 必须在 display 之前注册，否则会漏首次 relocated
      rendition.on("relocated", debouncedRelocated);

      rendition.hooks.content.register((contents: Contents) => {
        const win = contents.window;
        if (touchSwipeAttached.has(win)) return;
        touchSwipeAttached.add(win);
        const doc = contents.document;
        let startX = 0;
        let startY = 0;

        doc.addEventListener(
          "touchstart",
          (e: TouchEvent) => {
            if (!e.touches[0]) return;
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
            // touchStartedAtByWin.set(win, Date.now());
          },
          { passive: true }
        );

        doc.addEventListener(
          "touchend",
          (e: TouchEvent) => {
            if (!e.changedTouches[0]) return;
            /**
             * 划词时手指多为横向拖动，易被误判为「横滑翻页」并在 touchend 里 removeAllRanges，
             * iOS 上表现为选不中词、弹窗不出现。touchend 时若已有选区则不要翻页。
             */
            const selectedText =
              (() => {
                try {
                  return win.getSelection()?.toString().trim() ?? "";
                } catch {
                  return "";
                }
              })();
            if (selectedText.length > 0) return;

            const dx = e.changedTouches[0].clientX - startX;
            const dy = e.changedTouches[0].clientY - startY;
            const vw = win.innerWidth || 400;
            /** 窄屏上 112px 过长，适当按视口宽度降低，仍设下限避免误触 */
            const minSwipePx = Math.min(
              SWIPE_PAGE_MIN_PX,
              Math.max(72, Math.floor(vw * 0.22))
            );
            const isHorizontalSwipe =
              Math.abs(dx) >= minSwipePx &&
              Math.abs(dy) <= SWIPE_MAX_VERTICAL_PX &&
              Math.abs(dx) > Math.abs(dy);
            if (!isHorizontalSwipe) return;
            swipeNavAtByWin.set(win, Date.now());
            try {
              win.getSelection()?.removeAllRanges();
            } catch {
              /* ignore */
            }
            if (dx < 0) rendition.next();
            else rendition.prev();
            e.preventDefault();
          },
          { passive: false }
        );
      });

      rendition.on("selected", debouncedSelected);

      // 点击空白关闭弹层；划词后短时间内忽略 click，避免立刻关掉弹层
      rendition.on("click", () => {
        if (!mounted) return;
        if (Date.now() - lastSelectedAt < 300) return;
        setSelection(null);
      });

      rendition.themes.fontSize(`${fontSize}px`);

      await displayInitialReadingPosition(rendition, initialCfi, () => mounted);

      if (!mounted) return;
      setBookLoading(false);
      window.addEventListener("resize", onWindowResize);
    }

    initReader().catch((err) => {
      console.error(err);
      setBookLoading(false);
    });

    // 取消待执行的防抖、最后一次上报进度、销毁 rendition 与 book
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

  /** 字号仅变时改主题，不重跑整段 initReader。 */
  useEffect(() => {
    renditionRef.current?.themes.fontSize(`${fontSize}px`);
  }, [fontSize]);

  /** 左右方向键翻页（与 iframe 内滚动不冲突时由窗口捕获）。 */
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
      <div
        ref={viewerRef}
        className="h-full w-full min-h-0 overflow-hidden [overflow-anchor:none]"
        style={VIEWER_HOST_STYLE}
      />
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
