"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button-variants";
import { ArrowLeft, ChevronLeft, ChevronRight, List } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRef, useState, useEffect, Fragment } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
    console.log("[ReaderClient] 服务端 initialCfi:", initialCfi);
    console.log("[ReaderClient] localStorage CFI:", localCfi);
    const resolved = localCfi || initialCfi;
    console.log("[ReaderClient] 最终使用的 CFI:", resolved);
    setEffectiveCfi(resolved);
    setCfiReady(true);
  }, [bookId, initialCfi]);

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
        {/* 章节目录 */}
        <Popover open={tocOpen} onOpenChange={setTocOpen}>
          <PopoverTrigger
            className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "h-8 w-8 shrink-0")}
          >
            <List className="h-4 w-4" />
          </PopoverTrigger>
          <PopoverContent className="w-64 p-0 overflow-hidden" align="end" side="bottom">
            <div className="px-3 py-2 border-b border-border">
              <p className="text-sm font-medium">章节目录</p>
            </div>
            <div className="max-h-[calc(100vh-200px)] overflow-y-auto">
              {toc.length === 0 ? (
                <p className="px-3 py-4 text-xs text-muted-foreground text-center">暂无目录</p>
              ) : (
                renderTocItems(toc)
              )}
            </div>
          </PopoverContent>
        </Popover>
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
            onProgress={(_, pct, chapter) => {
              setPercent(pct);
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
