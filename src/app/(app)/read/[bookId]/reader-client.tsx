"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button-variants";
import { ArrowLeft, ChevronLeft, ChevronRight, List } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRef, useState, useEffect, Fragment } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { clientFetch } from "@/lib/client-fetch";
import { readerDebugLog } from "@/lib/reader-debug";
import type { TocItem } from "@/components/reader/epub-reader";

const EpubReader = dynamic(
  () => import("@/components/reader/epub-reader").then((m) => m.EpubReader),
  {
    ssr: false,
    loading: () => (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-muted-foreground">加载中...</div>
      </div>
    ),
  }
);

const FONT_SIZE_KEY = "reader-font-size";

interface ReaderControls {
  prev: () => void;
  next: () => void;
  displayChapter: (href: string) => void;
}

interface ReaderClientProps {
  bookId: string;
  title: string;
  blobUrl: string;
  initialCfi: string | null;
}

export function ReaderClient({ bookId, title, blobUrl, initialCfi }: ReaderClientProps) {
  const controlsRef = useRef<ReaderControls | null>(null);
  const [fontSize, setFontSize] = useState(20);
  const [chapterName, setChapterName] = useState("");
  const [percent, setPercent] = useState(0);
  const [toc, setToc] = useState<TocItem[]>([]);
  const [tocOpen, setTocOpen] = useState(false);
  // 优先使用 localStorage 中的 CFI，解决 Next.js 路由缓存导致服务端数据陈旧的问题
  const [effectiveCfi, setEffectiveCfi] = useState<string | null>(null);
  const [cfiReady, setCfiReady] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(FONT_SIZE_KEY);
    if (saved) {
      const n = parseInt(saved, 10);
      if (n >= 12 && n <= 28) setFontSize(n);
    }
    // 优先 localStorage CFI，fallback 到服务端值
    const localCfi = localStorage.getItem(`reader-cfi-${bookId}`);
    const resolved = localCfi || initialCfi;
    readerDebugLog("ReaderClient 解析 CFI", {
      服务端initialCfi: initialCfi,
      localStorageCfi: localCfi,
      最终effectiveCfi: resolved,
      字号localStorage: saved ?? null,
    });
    setEffectiveCfi(resolved);
    setCfiReady(true);
  }, [bookId, initialCfi]);

  useEffect(() => {
    if (!cfiReady) return;
    readerDebugLog("ReaderClient 已就绪，即将渲染 EpubReader", {
      effectiveCfi,
      fontSizeState: fontSize,
    });
  }, [cfiReady, effectiveCfi, fontSize]);

  // 阅读页前台活跃时长 → 上报累加（与仪表盘柱状图一致，按 UTC 日聚合）
  useEffect(() => {
    if (!cfiReady) return;

    let lastMark = Date.now();

    function postSeconds(seconds: number) {
      const n = Math.round(seconds);
      if (n < 1) return;
      const capped = Math.min(120, n);
      const body = JSON.stringify({ seconds: capped });
      void clientFetch("/api/reading/time", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
        showErrorToast: false,
      }).catch(() => {});
    }

    function flushVisible() {
      if (document.visibilityState !== "visible") {
        lastMark = Date.now();
        return;
      }
      const elapsed = (Date.now() - lastMark) / 1000;
      lastMark = Date.now();
      postSeconds(Math.min(elapsed, 120));
    }

    const interval = setInterval(flushVisible, 30_000);

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        lastMark = Date.now();
      } else {
        const elapsed = (Date.now() - lastMark) / 1000;
        lastMark = Date.now();
        postSeconds(Math.min(elapsed, 120));
      }
    };

    const onPageHide = () => {
      if (document.visibilityState !== "visible") return;
      const elapsed = (Date.now() - lastMark) / 1000;
      lastMark = Date.now();
      postSeconds(Math.min(elapsed, 120));
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      if (document.visibilityState === "visible") {
        const elapsed = (Date.now() - lastMark) / 1000;
        postSeconds(Math.min(elapsed, 120));
      }
    };
  }, [cfiReady]);

  function changeFontSize(delta: number) {
    setFontSize((prev) => {
      const next = Math.max(12, Math.min(28, prev + delta));
      localStorage.setItem(FONT_SIZE_KEY, String(next));
      return next;
    });
  }

  function renderTocItems(items: TocItem[], depth = 0) {
    return items.map((item) => (
      <Fragment key={item.href + depth}>
        <button
          onClick={() => {
            controlsRef.current?.displayChapter(item.href);
            setTocOpen(false);
          }}
          className={cn(
            "w-full text-left py-2 text-sm hover:bg-accent transition-colors truncate block",
            depth === 0 ? "font-medium text-foreground" : "text-muted-foreground"
          )}
          style={{ paddingLeft: `${12 + depth * 16}px`, paddingRight: "12px" }}
        >
          {item.label}
        </button>
        {item.subitems?.length ? renderTocItems(item.subitems, depth + 1) : null}
      </Fragment>
    ));
  }

  return (
    <div className="flex flex-col h-full">
      {/* 顶栏：返回 + 书名 + 字号调节 + 章节目录 */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-card shrink-0">
        <Link
          href="/library"
          className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "h-8 w-8 shrink-0")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-sm font-medium truncate flex-1 min-w-0">{title}</h1>
        {/* 字号调节 */}
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            onClick={() => changeFontSize(-2)}
            className="h-7 w-8 flex items-center justify-center rounded hover:bg-accent text-xs font-bold text-muted-foreground"
          >
            A-
          </button>
          <span className="text-xs text-muted-foreground w-7 text-center tabular-nums">
            {fontSize}
          </span>
          <button
            onClick={() => changeFontSize(2)}
            className="h-7 w-8 flex items-center justify-center rounded hover:bg-accent font-bold text-muted-foreground"
            style={{ fontSize: "15px" }}
          >
            A+
          </button>
        </div>
        {/* 章节目录：与顶栏移动端一致的左侧抽屉 */}
        <Sheet open={tocOpen} onOpenChange={setTocOpen}>
          <SheetTrigger
            className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "h-8 w-8 shrink-0")}
          >
            <List className="h-4 w-4" />
          </SheetTrigger>
          <SheetContent
            side="left"
            showCloseButton={false}
            className="w-[min(100%,20rem)] sm:max-w-sm p-0 flex flex-col gap-0"
          >
            <div className="flex items-center gap-2 px-4 py-4 border-b border-border shrink-0">
              <List className="h-5 w-5 text-primary" />
              <span className="font-semibold text-base">章节目录</span>
            </div>
            <nav className="flex-1 min-h-0 overflow-y-auto px-2 py-2">
              {toc.length === 0 ? (
                <p className="px-3 py-6 text-sm text-muted-foreground text-center">暂无目录</p>
              ) : (
                renderTocItems(toc)
              )}
            </nav>
          </SheetContent>
        </Sheet>
      </div>

      {/* 阅读区域：等 localStorage 读取完毕再渲染，避免用错误的 initialCfi 初始化 */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {cfiReady && (
          <EpubReader
            bookId={bookId}
            blobUrl={blobUrl}
            initialCfi={effectiveCfi}
            fontSize={fontSize}
            onReady={(controls) => { controlsRef.current = controls; }}
            onTocReady={(items) => setToc(items)}
            onProgress={(_, bookPct, chapter, chapterPct) => {
              const next = chapterPct ?? bookPct;
              if (next != null) setPercent(next);
              if (chapter) setChapterName(chapter);
            }}
          />
        )}
      </div>

      {/* 底栏：上一章 + 章节名/进度 + 下一章 */}
      <div className="flex items-center px-2 py-2 border-t border-border bg-card shrink-0 gap-2">
        <button
          onClick={() => controlsRef.current?.prev()}
          className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "h-8 w-8 shrink-0")}
          aria-label="上一章"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <div className="flex-1 min-w-0 text-center leading-tight">
          {chapterName && (
            <p className="text-xs text-muted-foreground truncate">{chapterName}</p>
          )}
          <p className="text-xs text-muted-foreground tabular-nums">{Math.round(percent)}%</p>
        </div>

        <button
          onClick={() => controlsRef.current?.next()}
          className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "h-8 w-8 shrink-0")}
          aria-label="下一章"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
