"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { clientFetch, errorMessageFromApiBody, CLIENT_FETCH_NETWORK_ERROR } from "@/lib/client-fetch";

type TestResult = {
  status: number | null;
  ok: boolean;
  body: string;
  /** clientFetch 模式下展示 toast 的错误文案 */
  toastMessage?: string;
};

interface TestCase {
  id: string;
  group: string;
  label: string;
  method: string;
  url: string;
  body: unknown;
  expectedStatus: number;
}

const TEST_CASES: TestCase[] = [
  {
    id: "vocab-empty-word",
    group: "POST /api/vocabulary",
    label: "word 为空",
    method: "POST",
    url: "/api/vocabulary",
    body: {},
    expectedStatus: 400,
  },
  {
    id: "vocab-word-too-long",
    group: "POST /api/vocabulary",
    label: "word 超过 100 字符",
    method: "POST",
    url: "/api/vocabulary",
    body: { word: "a".repeat(101) },
    expectedStatus: 400,
  },
  {
    id: "vocab-context-too-long",
    group: "POST /api/vocabulary",
    label: "context 超过 500 字符",
    method: "POST",
    url: "/api/vocabulary",
    body: { word: "test", context: "a".repeat(501) },
    expectedStatus: 400,
  },
  {
    id: "vocab-update-note-too-long",
    group: "PUT /api/vocabulary/[id]",
    label: "note 超过 2000 字符",
    method: "PUT",
    url: "/api/vocabulary/placeholder-id",
    body: { note: "a".repeat(2001) },
    expectedStatus: 400,
  },
  {
    id: "vocab-update-def-too-long",
    group: "PUT /api/vocabulary/[id]",
    label: "definition 超过 8000 字符",
    method: "PUT",
    url: "/api/vocabulary/placeholder-id",
    body: { definition: "a".repeat(8001) },
    expectedStatus: 400,
  },
  {
    id: "books-empty-title",
    group: "POST /api/books",
    label: "缺少必填字段 title / blobUrl",
    method: "POST",
    url: "/api/books",
    body: {},
    expectedStatus: 400,
  },
  {
    id: "books-invalid-cover",
    group: "POST /api/books",
    label: "coverUrl 不是合法 URL",
    method: "POST",
    url: "/api/books",
    body: { title: "Test", blobUrl: "https://example.com/book.epub", coverUrl: "not-a-url" },
    expectedStatus: 400,
  },
  {
    id: "books-patch-invalid-cover",
    group: "PATCH /api/books/[id]",
    label: "coverUrl 不是合法 URL",
    method: "PATCH",
    url: "/api/books/placeholder-id",
    body: { coverUrl: "not-a-url" },
    expectedStatus: 400,
  },
  {
    id: "progress-out-of-range",
    group: "PUT /api/books/[id]/progress",
    label: "readingProgress > 100",
    method: "PUT",
    url: "/api/books/placeholder-id/progress",
    body: { readingProgress: 150 },
    expectedStatus: 400,
  },
  {
    id: "progress-negative",
    group: "PUT /api/books/[id]/progress",
    label: "readingProgress < 0",
    method: "PUT",
    url: "/api/books/placeholder-id/progress",
    body: { readingProgress: -1 },
    expectedStatus: 400,
  },
  {
    id: "from-public-invalid-uuid",
    group: "POST /api/books/from-public",
    label: "publicBookId 不是合法 UUID",
    method: "POST",
    url: "/api/books/from-public",
    body: { publicBookId: "not-a-uuid" },
    expectedStatus: 400,
  },
  {
    id: "reading-time-seconds-too-high",
    group: "POST /api/reading/time",
    label: "seconds > 120",
    method: "POST",
    url: "/api/reading/time",
    body: { seconds: 150 },
    expectedStatus: 400,
  },
  {
    id: "reading-time-seconds-too-low",
    group: "POST /api/reading/time",
    label: "seconds < 1",
    method: "POST",
    url: "/api/reading/time",
    body: { seconds: 0 },
    expectedStatus: 400,
  },
  {
    id: "prefs-empty-body",
    group: "PATCH /api/user/preferences",
    label: "空 body（refine 拦截）",
    method: "PATCH",
    url: "/api/user/preferences",
    body: {},
    expectedStatus: 400,
  },
  {
    id: "prefs-timezone-too-long",
    group: "PATCH /api/user/preferences",
    label: "timeZone 超过 120 字符",
    method: "PATCH",
    url: "/api/user/preferences",
    body: { timeZone: "a".repeat(121) },
    expectedStatus: 400,
  },
  {
    id: "review-submit-missing-id",
    group: "POST /api/review/submit",
    label: "缺少 vocabularyId",
    method: "POST",
    url: "/api/review/submit",
    body: { result: "remembered" },
    expectedStatus: 400,
  },
  {
    id: "review-submit-invalid-result",
    group: "POST /api/review/submit",
    label: "result 不是枚举值",
    method: "POST",
    url: "/api/review/submit",
    body: { vocabularyId: "x", result: "invalid" },
    expectedStatus: 400,
  },
  {
    id: "review-stats-empty-body",
    group: "POST /api/review/stats",
    label: "空 body（refine 拦截）",
    method: "POST",
    url: "/api/review/stats",
    body: {},
    expectedStatus: 400,
  },
  {
    id: "review-stats-seconds-too-high",
    group: "POST /api/review/stats",
    label: "seconds > 50",
    method: "POST",
    url: "/api/review/stats",
    body: { seconds: 60 },
    expectedStatus: 400,
  },
  {
    id: "finalize-empty-title",
    group: "POST /api/library/public/finalize",
    label: "缺少 title",
    method: "POST",
    url: "/api/library/public/finalize",
    body: { blobUrl: "https://example.com/book.epub", blobKey: "epubs/public/x", fileSize: 1000 },
    expectedStatus: 400,
  },
  {
    id: "finalize-file-too-large",
    group: "POST /api/library/public/finalize",
    label: "fileSize > 50MB",
    method: "POST",
    url: "/api/library/public/finalize",
    body: { blobUrl: "https://example.com/book.epub", blobKey: "epubs/public/x", fileSize: 60 * 1024 * 1024, title: "Test" },
    expectedStatus: 400,
  },
];

async function parseApiErrorBody(res: Response): Promise<{ message?: unknown; error?: unknown } | null> {
  try {
    return (await res.clone().json()) as { message?: unknown; error?: unknown };
  } catch {
    return null;
  }
}

export default function ValidationErrorTestPage() {
  const [results, setResults] = useState<Record<string, TestResult>>({});
  const [running, setRunning] = useState<Record<string, boolean>>({});
  const [useClientFetch, setUseClientFetch] = useState(false);

  const runSingle = useCallback(async (tc: TestCase) => {
    setRunning((prev) => ({ ...prev, [tc.id]: true }));
    setResults((prev) => ({
      ...prev,
      [tc.id]: { status: null, ok: false, body: "请求中…" },
    }));
    try {
      let res: Response;
      let toastMsg: string | undefined;

      if (useClientFetch) {
        res = await clientFetch(tc.url, {
          method: tc.method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(tc.body),
          showErrorToast: true,
          redirectOn401: false,
        });
        // clientFetch 没有抛异常，说明已 toast。解析提取的错误文案
        const cloned = res.clone();
        const body = await parseApiErrorBody(cloned);
        toastMsg = errorMessageFromApiBody(body, res.status);
      } else {
        res = await fetch(tc.url, {
          method: tc.method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(tc.body),
        });
      }

      const text = await res.text();
      let display = text;
      try {
        display = JSON.stringify(JSON.parse(text), null, 2);
      } catch { /* plain text */ }
      setResults((prev) => ({
        ...prev,
        [tc.id]: { status: res.status, ok: res.ok, body: display, toastMessage: toastMsg },
      }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setResults((prev) => ({
        ...prev,
        [tc.id]: { status: null, ok: false, body: msg, toastMessage: msg === CLIENT_FETCH_NETWORK_ERROR ? msg : undefined },
      }));
    } finally {
      setRunning((prev) => ({ ...prev, [tc.id]: false }));
    }
  }, [useClientFetch]);

  const runGroup = useCallback((group: string) => {
    TEST_CASES.filter((tc) => tc.group === group).forEach((tc) => runSingle(tc));
  }, [runSingle]);

  const runAll = useCallback(() => {
    TEST_CASES.forEach((tc) => runSingle(tc));
  }, [runSingle]);

  const groups = Array.from(new Set(TEST_CASES.map((tc) => tc.group)));

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div className="space-y-1">
        <h1 className="text-xl font-bold">validationError 统一测试</h1>
        <p className="text-sm text-muted-foreground">
          对所有已改用 <code className="rounded bg-muted px-1 py-0.5 text-xs">validationError()</code> 的路由发送无效数据，验证响应格式是否为{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">{`{ "message": "具体错误" }`}</code>
        </p>
        <p className="text-xs text-muted-foreground">
          仅本地 development；需已登录。每个测试预期 HTTP 400。
        </p>
      </div>

      <div className="flex gap-2">
        <Button type="button" onClick={runAll} size="sm">
          运行全部测试
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => { setResults({}); }}
        >
          清空结果
        </Button>
      </div>

      <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
        <input
          type="checkbox"
          checked={useClientFetch}
          onChange={(e) => setUseClientFetch(e.target.checked)}
          className="size-4 rounded border"
        />
        <span>
          通过 <code className="rounded bg-muted px-1 py-0.5 text-xs font-mono">clientFetch</code> 发送
          <span className="text-muted-foreground ml-1">
            （启用后错误响应会自动弹出 Sonner toast，可验证 toast 文案与接口返回一致）
          </span>
        </span>
      </label>

      {groups.map((group) => (
        <Card key={group}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-mono">{group}</CardTitle>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => runGroup(group)}
                disabled={Object.values(running).some(Boolean)}
              >
                运行本组
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-0">
            {TEST_CASES.filter((tc) => tc.group === group).map((tc) => {
              const r = results[tc.id];
              return (
                <div key={tc.id} className="rounded-lg border p-3">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-2">
                    <span className="text-sm font-medium">{tc.label}</span>
                    <span className="text-xs text-muted-foreground">
                      → <code className="rounded bg-muted px-1 py-0.5">{tc.method} {tc.url}</code>
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-2 text-xs">
                    <span className="text-muted-foreground">
                      请求体: <code className="rounded bg-muted px-1 py-0.5">{JSON.stringify(tc.body)}</code>
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => runSingle(tc)}
                      disabled={running[tc.id]}
                    >
                      {running[tc.id] ? "请求中…" : "测试"}
                    </Button>
                    {r && (
                      <>
                        <span>
                          状态{" "}
                          <span
                            className={cn(
                              "rounded px-1.5 py-0.5 font-mono text-xs font-semibold text-white",
                              r.status === tc.expectedStatus ? "bg-green-600" : "bg-red-600"
                            )}
                          >
                            {r.status ?? "网络错误"}
                          </span>
                        </span>
                        {r.ok !== (tc.expectedStatus >= 200 && tc.expectedStatus < 300) && (
                          <span className="text-xs text-muted-foreground">
                            （预期 {tc.expectedStatus}）
                          </span>
                        )}
                        {r.toastMessage && (
                          <span className="text-xs text-muted-foreground">
                            toast 文案:{" "}
                            <code className="rounded bg-muted px-1 py-0.5">{r.toastMessage}</code>
                          </span>
                        )}
                      </>
                    )}
                  </div>
                  {r && (
                    <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded bg-muted/40 p-2 font-mono text-xs">
                      {r.body}
                    </pre>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}

      <Link href="/dev" className={cn(buttonVariants({ variant: "link" }), "px-0")}>
        返回开发工具
      </Link>
    </div>
  );
}