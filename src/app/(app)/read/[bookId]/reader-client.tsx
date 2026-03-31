"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button-variants";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRef, useState, useEffect } from "react";

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

  // 从 localStorage 恢复字号
  useEffect(() => {
    const saved = localStorage.getItem(FONT_SIZE_KEY);
    if (saved) {
      const n = parseInt(saved, 10);
      if (n >= 12 && n <= 28) setFontSize(n);
    }
  }, []);

  function changeFontSize(delta: number) {
    setFontSize((prev) => {
      const next = Math.max(12, Math.min(28, prev + delta));
      localStorage.setItem(FONT_SIZE_KEY, String(next));
      return next;
    });
  }

  return (
    <div className="flex flex-col h-full">
      {/* 顶栏：返回 + 书名 + 字号调节 */}
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
      </div>

      {/* 阅读区域 */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <EpubReader
          bookId={bookId}
          blobUrl={blobUrl}
          initialCfi={initialCfi}
          fontSize={fontSize}
          onReady={(controls) => { controlsRef.current = controls; }}
          onProgress={(_, pct, chapter) => {
            setPercent(pct);
            if (chapter) setChapterName(chapter);
          }}
        />
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
