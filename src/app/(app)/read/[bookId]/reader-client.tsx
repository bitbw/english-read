"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button-variants";
import { ArrowLeft, ChevronLeft, ChevronRight, List, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRef, useState, useEffect, useCallback, Fragment } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { clientFetch } from "@/lib/client-fetch";
import { readerDebugLog } from "@/lib/reader-debug";
import type { NavItem } from "epubjs";
import { useTranslations } from "next-intl";
import {
  type ReaderColorSchemeId,
  readColorSchemeFromStorage,
} from "@/lib/reader-color-scheme";
import { ReaderColorSchemeSelector } from "@/components/settings/reader-color-scheme-selector";
import { readingSpeedTierFromWpm } from "@/lib/reading-speed-tier";

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
  const tTier = useTranslations("readingSpeedTier");
  const controlsRef = useRef<ReaderControls | null>(null);
  const [fontSize, setFontSize] = useState(22);
  const [colorScheme, setColorScheme] = useState<ReaderColorSchemeId>(readColorSchemeFromStorage());
  const [chapterName, setChapterName] = useState("");
  /** 全书进度 0–100（epub locations 生成后才由阅读器填入） */
  const [bookPercent, setBookPercent] = useState<number | null>(null);
  /** 当前章内分页进度 0–100（`displayed.page/total`）；无分页信息时为 null */
  const [chapterPercent, setChapterPercent] = useState<number | null>(null);
  const [toc, setToc] = useState<NavItem[]>([]);
  const [tocOpen, setTocOpen] = useState(false);
  /** 与服务端 `initialCfi` 对齐；阅读位置仅通过服务端 PUT 持久化。 */
  const [effectiveCfi, setEffectiveCfi] = useState<string | null>(null);
  const [cfiReady, setCfiReady] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  /** 待上报的估算阅读量（仅在 epubjs locations.generate 完成后由阅读器填入） */
  const pendingWordsRef = useRef(0);
  const sessionWordsRef = useRef(0);
  const sessionSecondsRef = useRef(0);
  const wordsSinkRef = useRef<(n: number) => void>(() => {});

  const [readingSpeedSummary, setReadingSpeedSummary] = useState<{
    sessionWpm: number | null;
    todayWpm: number | null;
    sessionWords: number;
  }>({ sessionWpm: null, todayWpm: null, sessionWords: 0 });
  /** 与 epubjs locations.generate 成功对应；未完成前顶栏显示「正在索引」 */
  const [locationsIndexed, setLocationsIndexed] = useState(false);

  const refreshTodayWpm = useCallback(async () => {
    try {
      const r = await clientFetch("/api/reading/time?days=14", {
        showErrorToast: false,
      });
      if (!r.ok) return;
      const data = (await r.json()) as {
        series?: { day: string; seconds: number; words: number }[];
      };
      const series = data.series ?? [];
      if (series.length === 0) return;
      const last = series[series.length - 1]!;
      const sec = last.seconds;
      const w = last.words ?? 0;
      const todayWpm =
        sec >= 45 ? Math.round((w / Math.max(sec, 0.001)) * 60) : null;
      setReadingSpeedSummary((prev) => ({ ...prev, todayWpm }));
    } catch {
      /* ignore */
    }
  }, []);

  const bumpSessionSpeedUi = useCallback(() => {
    const sec = sessionSecondsRef.current;
    const words = sessionWordsRef.current;
    const sessionWpm =
      sec >= 20 ? Math.round((words / Math.max(sec, 0.001)) * 60) : null;
    setReadingSpeedSummary((prev) => ({
      ...prev,
      sessionWpm,
      sessionWords: words,
    }));
  }, []);

  useEffect(() => {
    setBookPercent(null);
    setChapterPercent(null);
    setChapterName("");
    pendingWordsRef.current = 0;
    sessionWordsRef.current = 0;
    sessionSecondsRef.current = 0;
    setReadingSpeedSummary((s) => ({ ...s, sessionWpm: null, sessionWords: 0 }));
    setLocationsIndexed(false);
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

  useEffect(() => {
    void refreshTodayWpm();
    const onVis = () => {
      if (document.visibilityState === "visible") void refreshTodayWpm();
    };
    document.addEventListener("visibilitychange", onVis);
    const t = window.setInterval(() => {
      void refreshTodayWpm();
    }, 90_000);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.clearInterval(t);
    };
  }, [refreshTodayWpm]);

  wordsSinkRef.current = (estimatedWords: number) => {
    const n = Math.round(estimatedWords);
    if (n < 1) return;
    const capped = Math.min(8000, n);
    pendingWordsRef.current += capped;
    sessionWordsRef.current += capped;
    bumpSessionSpeedUi();
  };

  // 阅读页前台活跃时长 → 上报累加（与仪表盘一致，按学习时区自然日聚合）
  useEffect(() => {
    if (!cfiReady) return;

    let lastMark = Date.now();

    function postStudyBatch(seconds: number) {
      const n = Math.round(seconds);
      if (n < 1) return;
      const capped = Math.min(120, n);
      sessionSecondsRef.current += capped;
      bumpSessionSpeedUi();

      const w = pendingWordsRef.current;
      pendingWordsRef.current = 0;
      const body =
        w > 0 ? JSON.stringify({ seconds: capped, words: w }) : JSON.stringify({ seconds: capped });
      void clientFetch("/api/reading/time", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
        showErrorToast: false,
      })
        .then(() => {
          void refreshTodayWpm();
        })
        .catch(() => {});
    }

    function flushVisible() {
      if (document.visibilityState !== "visible") {
        lastMark = Date.now();
        return;
      }
      const elapsed = (Date.now() - lastMark) / 1000;
      lastMark = Date.now();
      postStudyBatch(Math.min(elapsed, 120));
    }

    const interval = setInterval(flushVisible, 30_000);

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        lastMark = Date.now();
      } else {
        const elapsed = (Date.now() - lastMark) / 1000;
        lastMark = Date.now();
        postStudyBatch(Math.min(elapsed, 120));
      }
    };

    const onPageHide = () => {
      if (document.visibilityState !== "visible") return;
      const elapsed = (Date.now() - lastMark) / 1000;
      lastMark = Date.now();
      postStudyBatch(Math.min(elapsed, 120));
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      if (document.visibilityState === "visible") {
        const elapsed = (Date.now() - lastMark) / 1000;
        postStudyBatch(Math.min(elapsed, 120));
      }
    };
  }, [cfiReady, bumpSessionSpeedUi, refreshTodayWpm]);

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
    <div className="flex flex-col h-full bg-background">
      {/* 顶栏：返回 + 书名 + 字号调节 + 章节目录 */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-card shrink-0">
        <Link
          href="/library"
          className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "h-8 w-8 shrink-0")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-medium truncate">{title}</h1>
          {!locationsIndexed ? (
            <p className="text-[11px] text-muted-foreground truncate tabular-nums leading-snug mt-0.5">
              <span>{t("readingSpeedWarmup")}</span>
            </p>
          ) : (
            <>
              <p className="text-[11px] text-muted-foreground truncate tabular-nums leading-snug mt-0.5 sm:hidden">
                {t("readingSpeedMobileLine", {
                  sessionTier:
                    readingSpeedSummary.sessionWpm !== null
                      ? tTier(readingSpeedTierFromWpm(readingSpeedSummary.sessionWpm))
                      : "—",
                  words: String(readingSpeedSummary.sessionWords),
                })}
              </p>
              <p className="text-[11px] text-muted-foreground truncate tabular-nums leading-snug mt-0.5 hidden sm:block">
                {t("readingSpeedWideLine", {
                  sessionTier:
                    readingSpeedSummary.sessionWpm !== null
                      ? tTier(readingSpeedTierFromWpm(readingSpeedSummary.sessionWpm))
                      : "—",
                  session:
                    readingSpeedSummary.sessionWpm !== null
                      ? String(readingSpeedSummary.sessionWpm)
                      : "—",
                  todayTier:
                    readingSpeedSummary.todayWpm !== null
                      ? tTier(readingSpeedTierFromWpm(readingSpeedSummary.todayWpm))
                      : "—",
                  today:
                    readingSpeedSummary.todayWpm !== null
                      ? String(readingSpeedSummary.todayWpm)
                      : "—",
                })}
              </p>
            </>
          )}
        </div>
        {/* 阅读设置（字号 + 颜色模式） */}
        <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
          <SheetTrigger
            className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "h-8 w-8 shrink-0")}
          >
            <Settings className="h-4 w-4" />
          </SheetTrigger>
          <SheetContent
            side="right"
            showCloseButton={false}
            className="w-[min(100%,20rem)] sm:max-w-sm p-0 flex flex-col gap-0"
          >
            <div className="flex items-center gap-2 px-4 py-4 border-b border-border shrink-0">
              <Settings className="h-5 w-5 text-primary" />
              <span className="font-semibold text-base">{t("readerSettings")}</span>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-6">
              {/* 字号调节 */}
              <div className="space-y-3">
                <p className="text-sm font-medium">{t("fontSize")}</p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => changeFontSize(-2)}
                    className="h-8 w-9 flex items-center justify-center rounded-md border border-border hover:bg-accent text-xs font-bold text-muted-foreground"
                  >
                    A-
                  </button>
                  <span className="text-sm text-muted-foreground w-8 text-center tabular-nums font-medium">
                    {fontSize}
                  </span>
                  <button
                    onClick={() => changeFontSize(2)}
                    className="h-8 w-9 flex items-center justify-center rounded-md border border-border hover:bg-accent font-bold text-muted-foreground"
                    style={{ fontSize: "15px" }}
                  >
                    A+
                  </button>
                </div>
              </div>
              {/* 阅读颜色模式 */}
              <ReaderColorSchemeSelector
                value={colorScheme}
                onChange={setColorScheme}
              />
            </div>
          </SheetContent>
        </Sheet>
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
            colorScheme={colorScheme}
            onReady={(controls) => { controlsRef.current = controls; }}
            onTocReady={(items) => setToc(items)}
            onProgress={(_, bookPct, name, chapPct) => {
              if (bookPct !== null) setBookPercent(bookPct);
              setChapterName(name ?? "");
              setChapterPercent(chapPct);
            }}
            onLocationsReady={() => {
              setLocationsIndexed(true);
            }}
            onWordsDelta={(w) => {
              wordsSinkRef.current(w);
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
