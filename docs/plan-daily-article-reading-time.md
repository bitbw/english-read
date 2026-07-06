# 每日阅读计入学习时长 — 实现方案

## 背景

目前系统已有完整的学习时长记录体系：
- **EPUB 阅读器**（`reader-client.tsx`）通过心跳机制自动上报阅读时长到 `POST /api/reading/time`
- **词汇复习**自动上报复习时长
- 学习时长图表（`DailyStudyChart`、`StudyStatsPanel`）从 `GET /api/stats/study` 读取 `readingDailyTime` 表展示

但**每日文章阅读器**（`ArticleReaderClient`）完全没有阅读时长追踪。

## 实现思路

复用现有的 `POST /api/reading/time` 接口和 `readingDailyTime` 表——它们已经是通用设计（按 `userId + 日历日` 聚合）。只需在 `ArticleReaderClient` 中加入与 EPUB 阅读器类似的活跃时长心跳上报即可，**图表侧无需任何修改**。

## 目标改动

### 1. 提取共享 Hook（推荐）— `useReadingTimeTracker`

**文件：** `src/hooks/use-reading-time-tracker.ts`（新建）

从 `reader-client.tsx` 中提取活跃时长上报逻辑（`useEffect` 中 `visibilitychange` + `setInterval` 心跳），封装为可复用的 Hook：

```typescript
"use client";

import { useEffect, useRef } from "react";
import { clientFetch } from "@/lib/client-fetch";

interface ReadingTimeTrackerOptions {
  /** Hook 是否激活（例如等待组件就绪后才开始计时） */
  enabled: boolean;
  /** 心跳间隔（毫秒），默认 30_000 */
  intervalMs?: number;
  /** 每次上报的最大秒数，默认 120 */
  maxBatchSeconds?: number;
  /** 自定义词汇上报函数（可选，每日阅读无此数据） */
  onWordsFlush?: () => number;
}

export function useReadingTimeTracker({
  enabled,
  intervalMs = 30_000,
  maxBatchSeconds = 120,
  onWordsFlush,
}: ReadingTimeTrackerOptions) {
  const lastMarkRef = useRef(Date.now());

  useEffect(() => {
    if (!enabled) return;

    lastMarkRef.current = Date.now();

    function postBatch(seconds: number) {
      const n = Math.round(seconds);
      if (n < 1) return;
      const capped = Math.min(maxBatchSeconds, n);
      const words = onWordsFlush?.() ?? 0;
      const body =
        words > 0
          ? JSON.stringify({ seconds: capped, words })
          : JSON.stringify({ seconds: capped });

      void clientFetch("/api/reading/time", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
        showErrorToast: false,
      }).catch(() => {});
    }

    function flush() {
      const now = Date.now();
      const elapsed = (now - lastMarkRef.current) / 1000;
      lastMarkRef.current = now;
      postBatch(Math.min(elapsed, maxBatchSeconds));
    }

    const interval = setInterval(() => {
      if (document.visibilityState === "visible") flush();
    }, intervalMs);

    function onVisibility() {
      if (document.visibilityState === "visible") {
        lastMarkRef.current = Date.now();
      } else {
        flush();
      }
    }

    function onPageHide() {
      if (document.visibilityState !== "visible") return;
      flush();
    }

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      if (document.visibilityState === "visible") flush();
    };
  }, [enabled, intervalMs, maxBatchSeconds, onWordsFlush]);
}
```

### 2. 改造 `ArticleReaderClient` 引入时长追踪

**文件：** `src/app/(app)/articles/[id]/article-reader-client.tsx`

改动点：
1. 引入 `useReadingTimeTracker` Hook
2. 在组件主体中调用（页面加载后即开始计时，`enabled: true`）

```diff
 import { WordPopup, type WordPopupAnchorRect } from "@/components/reader/word-popup";
 import { cn } from "@/lib/utils";
 import { VOCAB_WORD_MAX_LENGTH } from "@/lib/vocabulary-limits";
 import { useTranslations } from "next-intl";
+import { useReadingTimeTracker } from "@/hooks/use-reading-time-tracker";

 export function ArticleReaderClient({ article }: { article: Article }) {
   const t = useTranslations("articles");
   const contentRef = useRef<HTMLDivElement>(null);
   const [popup, setPopup] = useState<PopupState | null>(null);

+  // 阅读时长追踪（页面可见时自动上报）
+  useReadingTimeTracker({ enabled: true });
```

不需要新增任何其他逻辑——`ArticleReaderClient` 没有 locations 机制，所以不报告词汇数，只上报时长。

### 3. 重构 `ReaderClient` 使用共享 Hook（可选改进）

**文件：** `src/app/(app)/read/[bookId]/reader-client.tsx`

可选——将现有的 inline 时长追踪逻辑替换为 `useReadingTimeTracker`，减少重复代码：

```diff
 // 替换 lines 190-261 的 useEffect
+import { useReadingTimeTracker } from "@/hooks/use-reading-time-tracker";
+
+useReadingTimeTracker({
+  enabled: cfiReady,
+  onWordsFlush: () => {
+    const w = pendingWordsRef.current;
+    pendingWordsRef.current = 0;
+    sessionWordsRef.current += w;
+    bumpSessionSpeedUi();
+    return w;
+  },
+});
```

## 无需修改的部分

| 模块 | 原因 |
|------|------|
| `POST /api/reading/time` | 已是通用接口，按 `userId + 日历日` 聚合 |
| `GET /api/stats/study` | 已从 `readingDailyTime` 表读取数据 |
| `DailyStudyChart` | 从 `/api/stats/study` 获取数据，自动包含每日阅读时长 |
| `StudyStatsPanel` | 同上 |
| 数据库 schema | `readingDailyTime` 表已有适当结构 |

## 注意事项

1. **词汇数**：每日阅读无法追踪精确词汇数（无 epubjs locations 机制），因此只上报 `seconds`。图表中的 WPM 和词汇列在每日阅读产生的日期会显示为 0/「—」，不影响整体统计。
2. **i18n**：无需添加新翻译 key，图表文案复用已有内容。
3. **测试**：人工验证即可——打开每日文章，停留 30+ 秒，查看学习时长图表是否有数据更新。

## 文件清单

| 操作 | 文件 |
|------|------|
| 新建 | `src/hooks/use-reading-time-tracker.ts` |
| 修改 | `src/app/(app)/articles/[id]/article-reader-client.tsx` |
| 可选修改 | `src/app/(app)/read/[bookId]/reader-client.tsx` |

## 工作量预估

- **核心方案（新建 Hook + 修改 ArticleReaderClient）**：约 15 分钟
- **含重构 ReaderClient**：额外 10 分钟