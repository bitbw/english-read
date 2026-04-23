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
import type { NavItem } from "epubjs";
import { useTranslations } from "next-intl";

function EpubReaderLoading() {
  const t = useTranslations("reader");
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-muted-foreground">{t("loadingReader")}</div>
    </div>
  );
}

/** 仅在下发并执行 EpubReader 的 JS 分包时展示；拉取 EPUB（blobUrl）时的 loading 在 EpubReader 内部 */
const EpubReader = dynamic(
  () => import("@/components/reader/epub-reader").then((m) => m.EpubReader),
  {
    ssr: false,
    loading: EpubReaderLoading,
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
  const t = useTranslations("reader");
  const controlsRef = useRef<ReaderControls | null>(null);
  const [fontSize, setFontSize] = useState(20);
  const [chapterName, setChapterName] = useState("");
  /** 全书进度 0–100（spine 索引 + 章内 page/total） */
  const [bookPercent, setBookPercent] = useState<number | null>(null);
  /** 当前章内分页进度 0–100（`displayed.page/total`）；无分页信息时为 null */
  const [chapterPercent, setChapterPercent] = useState<number | null>(null);
  const [toc, setToc] = useState<NavItem[]>([]);
  const [tocOpen, setTocOpen] = useState(false);
  /** 与服务端 `initialCfi` 对齐；阅读位置仅通过服务端 PUT 持久化。 */
  const [effectiveCfi, setEffectiveCfi] = useState<string | null>(null);
  const [cfiReady, setCfiReady] = useState(false);

  useEffect(() => {
    setBookPercent(null);
    setChapterPercent(null);
    setChapterName("");
  }, [bookId]);

  useEffect(() => {
    const saved = localStorage.getItem(FONT_SIZE_KEY);
    if (saved) {
      const n = parseInt(saved, 10);
      if (n >= 12 && n <= 28) setFontSize(n);
    }
    const resolved = initialCfi;
    readerDebugLog("ReaderClient 解析 CFI", {
      服务端initialCfi: initialCfi,
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

  // 阅读页前台活跃时长 → 上报累加（与仪表盘一致，按学习时区自然日聚合）
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

  function renderTocItems(items: NavItem[], depth = 0) {
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
              <span className="font-semibold text-base">{t("toc")}</span>
            </div>
            <nav className="flex-1 min-h-0 overflow-y-auto px-2 py-2">
              {toc.length === 0 ? (
                <p className="px-3 py-6 text-sm text-muted-foreground text-center">{t("noToc")}</p>
              ) : (
                renderTocItems(toc)
              )}
            </nav>
          </SheetContent>
        </Sheet>
      </div>

      {/* 阅读区域：等客户端 effect 跑完（字号等）再挂 EpubReader，避免水合与首帧不一致 */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {cfiReady && (
          <EpubReader
            bookId={bookId}
            blobUrl={blobUrl}
            initialCfi={effectiveCfi}
            fontSize={fontSize}
            onReady={(controls) => { controlsRef.current = controls; }}
            onTocReady={(items) => setToc(items)}
            onProgress={(_, bookPct, name, chapPct) => {
              setBookPercent(bookPct);
              setChapterName(name ?? "");
              setChapterPercent(chapPct);
            }}
          />
        )}
      </div>

      {/* 底栏：上一章 + 章节名/进度 + 下一章 */}
      <div className="flex items-center px-2 py-2 border-t border-border bg-card shrink-0 gap-2">
        <button
          onClick={() => controlsRef.current?.prev()}
          className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "h-8 w-8 shrink-0")}
          aria-label={t("prevChapter")}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <div className="flex-1 min-w-0 text-center leading-tight">
          {chapterName && (
            <p className="text-xs text-muted-foreground truncate">{chapterName}</p>
          )}
          <p className="text-xs text-muted-foreground tabular-nums">
            {t("bookProgress")}{" "}
            {bookPercent == null ? "…" : `${Math.round(bookPercent)}%`}
            <span className="text-muted-foreground/70"> · </span>
            {t("chapterProgress")}{" "}
            {chapterPercent == null ? "…" : `${Math.round(chapterPercent)}%`}
          </p>
        </div>

        <button
          onClick={() => controlsRef.current?.next()}
          className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "h-8 w-8 shrink-0")}
          aria-label={t("nextChapter")}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
