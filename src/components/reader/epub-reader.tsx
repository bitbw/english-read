"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import ePub, {
  type Book,
  type Contents,
  type Location,
  type NavItem,
  type Rendition,
} from "epubjs";
import { WordPopup, type WordPopupAnchorRect } from "./word-popup";
import { debounce } from "@/lib/debounce";
import { readerDebugLog } from "@/lib/reader-debug";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { applyReaderSkinToContents } from "@/components/reader/reader-skin-css";
import {
  type ReaderColorSchemeId,
  DEFAULT_COLOR_SCHEME,
} from "@/lib/reader-color-scheme";
import {
  chapterDisplayName,
  chapterPctFromDisplayed,
  excerptSentenceForVocabulary,
  wholeBookPctFromSpine,
} from "@/components/reader/epub-reader-location";
import {
  paragraphSnippetFromSelection,
  wordPopupAnchorFromIframeSelection,
} from "@/components/reader/epub-reader-selection";
import {
  displayInitialReadingPosition,
  resizeRenditionToViewer,
  viewerPixelDimensions,
} from "@/components/reader/epub-rendition-tools";
import { saveReadingProgressToServer } from "@/lib/reader-progress-save";

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
  colorScheme?: ReaderColorSchemeId;
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

const RELOCATED_DEBOUNCE_MS = 300;
const SELECTED_DEBOUNCE_MS = 200;

/** 横向滑动超过此距离（px）且以水平为主时触发翻页（略大以减少误触）。 */
const SWIPE_PAGE_MIN_PX = 112;
/** 滑动时允许的最大纵向偏移（px），超过则视为滚动而非翻页。 */
const SWIPE_MAX_VERTICAL_PX = 96;
/** 从 touchstart 到选区出现超过此时长视为长按选词：不打开查词弹层（在防抖前判定，不含防抖延迟）。 */
const LONG_PRESS_NO_POPUP_MS = 450;

/**
 * 阅读器外壳样式。勿对宿主设 `-webkit-touch-callout: none`：在 iOS/WebKit 上会抑制长按呼出的
 * 选词/复制菜单，表现为「划不了词」。正文在 iframe 内，该属性也解决不了 iframe 内冲突。
 */
const VIEWER_HOST_STYLE: CSSProperties & { WebkitUserDrag?: "none" } = {
  WebkitUserDrag: "none",
  userSelect: "text",
};

/** EPUB 阅读器：分页渲染、进度与划词；epubjs 仅在客户端加载。 */
export function EpubReader({
  bookId,
  blobUrl,
  initialCfi,
  fontSize,
  colorScheme: colorSchemeProp,
  onProgress,
  onReady,
  onTocReady,
}: EpubReaderProps) {
  const t = useTranslations("reader");
  const { resolvedTheme } = useTheme();
  const resolvedThemeRef = useRef(resolvedTheme);
  resolvedThemeRef.current = resolvedTheme;
  const colorSchemeRef = useRef<ReaderColorSchemeId>(DEFAULT_COLOR_SCHEME);
  // 同步外部传入的 colorScheme 到 ref（供 content hook 和主题切换 effect 使用）
  if (colorSchemeProp && colorSchemeProp !== colorSchemeRef.current) {
    colorSchemeRef.current = colorSchemeProp;
  }
  const viewerRef = useRef<HTMLDivElement>(null);
  const bookRef = useRef<Book | null>(null);
  const renditionRef = useRef<Rendition | null>(null);
  const currentCfiRef = useRef<string>("");
  const currentPctRef = useRef<number>(0);
  const navTocRef = useRef<NavItem[]>([]);
  const [selection, setSelection] = useState<SelectionInfo | null>(null);
  /** 供 epub 事件回调读取：弹窗是否打开（避免闭包读到旧的 selection）。 */
  const selectionOpenRef = useRef(false);
  selectionOpenRef.current = selection !== null;

  /** 关闭查词弹窗；仅在原先确有弹窗时清除 iframe 选区（避免 click 抢在防抖前清空划词）。 */
  const dismissWordPopup = useCallback(() => {
    const hadOpenPopup = selectionOpenRef.current;
    setSelection(null);
    if (!hadOpenPopup) return;
    const list = renditionRef.current?.getContents() as unknown as
      | Contents[]
      | undefined;
    if (!list) return;
    for (const c of list) {
      try {
        c.window.getSelection()?.removeAllRanges();
      } catch {
        /* ignore */
      }
    }
  }, []);

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
    /** iframe 内最近一次 touchstart 时间（用于长按不弹窗，仅触摸）。 */
    const touchStartedAtByWin = new WeakMap<Window, number>();
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
      const chapterName = chapterDisplayName(location, navTocRef.current, (n) =>
        t("chapterDefault", { n })
      );
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
        // 弹窗已开时：本次划词/点选只关闭弹窗，不换新词（需再操作一次才查词）
        if (selectionOpenRef.current) {
          try {
            win.getSelection()?.removeAllRanges();
          } catch {
            /* ignore */
          }
          dismissWordPopup();
          lastSelectedAt = Date.now();
          return;
        }
        lastSelectedAt = Date.now();
        const sel = win.getSelection();
        if (!sel) return;
        const text = sel.toString().trim();
        if (!text || text.length > 200) return;
        const iframe = win.frameElement as HTMLIFrameElement | null;
        if (!iframe) return;
        const anchorRect = wordPopupAnchorFromIframeSelection(sel, iframe);
        if (!anchorRect) return;
        const raw = paragraphSnippetFromSelection(sel);
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

    /**
     * 在防抖前判定长按：仅跳过查词弹层（系统长按选词菜单场景）。
     */
    function handleSelected(cfiRange: string, contents: Contents) {
      if (!mounted) return;
      const win = contents.window as Window;
      const t0 = touchStartedAtByWin.get(win);
      if (t0 !== undefined && Date.now() - t0 >= LONG_PRESS_NO_POPUP_MS) {
        return;
      }
      debouncedSelected(cfiRange, contents);
    }

    /** 使用 ref 中当前锚点与进度上报（供 relocated 与卸载清理调用）。 */
    function persistProgressToServer() {
      if (!currentCfiRef.current) return;
      saveReadingProgressToServer(
        bookId,
        currentCfiRef.current,
        currentPctRef.current
      );
    }

    /** 窗口尺寸变化时同步 rendition 视口，避免分页错位。 */
    function onWindowResize() {
      if (!viewerRef.current || !renditionRef.current) return;
      resizeRenditionToViewer(renditionRef.current, viewerRef.current);
    }

    /** 创建 Book / Rendition，绑定事件后首屏 display，并结束 loading。 */
    async function initReader() {
      // 无挂载容器则无法渲染，直接结束 loading
      if (!viewerRef.current) {
        setBookLoading(false);
        return;
      }

      const { width: w, height: h } = viewerPixelDimensions(viewerRef.current);

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
        flow: "auto",
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

      // 触摸横滑翻页（与 iOS 划词可能冲突；顶栏/键盘仍可翻页）
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
            touchStartedAtByWin.set(win, Date.now());
          },
          { passive: true }
        );

        doc.addEventListener(
          "touchend",
          (e: TouchEvent) => {
            if (!e.changedTouches[0]) return;
            const dx = e.changedTouches[0].clientX - startX;
            const dy = e.changedTouches[0].clientY - startY;
            const isHorizontalSwipe =
              Math.abs(dx) >= SWIPE_PAGE_MIN_PX &&
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

      rendition.on("selected", handleSelected);

      // 仅当弹窗已打开时点正文才关闭（与原先 setSelection(null) 一致）；无弹窗时勿跑 dismiss，以免 removeAllRanges 抢在 selected 防抖之前清空选区
      rendition.on("click", () => {
        if (!mounted) return;
        if (!selectionOpenRef.current) return;
        if (Date.now() - lastSelectedAt < 300) return;
        dismissWordPopup();
      });

      rendition.hooks.content.register((contents: Contents) => {
        applyReaderSkinToContents(
          contents,
          resolvedThemeRef.current === "dark",
          colorSchemeRef.current
        );
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
  }, [blobUrl, initialCfi, bookId, dismissWordPopup]);

  /** 字号仅变时改主题，不重跑整段 initReader。 */
  useEffect(() => {
    renditionRef.current?.themes.fontSize(`${fontSize}px`);
  }, [fontSize]);

  /** 全局亮/暗切换时同步 iframe 内阅读皮肤（不重载 epub）。 */
  useEffect(() => {
    const rendition = renditionRef.current;
    if (!rendition) return;
    const isDark = resolvedTheme === "dark";
    const scheme = colorSchemeRef.current;
    const contentsList = rendition.getContents() as unknown as Contents[];
    for (const c of contentsList) {
      applyReaderSkinToContents(c, isDark, scheme);
    }
  }, [resolvedTheme]);

  /** 颜色方案变更时同步 iframe 内阅读皮肤。 */
  useEffect(() => {
    if (!colorSchemeProp) return;
    const rendition = renditionRef.current;
    if (!rendition) return;
    const isDark = resolvedTheme === "dark";
    const contentsList = rendition.getContents() as unknown as Contents[];
    for (const c of contentsList) {
      applyReaderSkinToContents(c, isDark, colorSchemeProp);
    }
  }, [colorSchemeProp, resolvedTheme]);

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
    <div className="relative h-full w-full min-h-0 bg-background">
      <div
        ref={viewerRef}
        className="h-full w-full min-h-0 overflow-hidden bg-background [overflow-anchor:none]"
        style={VIEWER_HOST_STYLE}
      />
      {bookLoading ? (
        <div
          className="absolute inset-0 z-10 flex items-center justify-center bg-background/80"
          role="status"
          aria-live="polite"
        >
          <p className="text-sm text-muted-foreground">{t("loadingBook")}</p>
        </div>
      ) : null}
      {selection ? (
        <>
          {/* 点击/触摸正文与顶栏等弹窗外的区域：仅关闭弹窗，不穿透到 epub 触发新查词 */}
          <div
            role="presentation"
            aria-hidden
            className="fixed inset-0 z-90 touch-none"
            onPointerDown={(e) => {
              e.preventDefault();
              dismissWordPopup();
            }}
          />
          <WordPopup
            word={selection.word}
            context={selection.context}
            contextCfi={selection.cfi}
            bookId={bookId}
            anchorRect={selection.anchorRect}
            onClose={dismissWordPopup}
            onSaved={dismissWordPopup}
          />
        </>
      ) : null}
    </div>
  );
}
