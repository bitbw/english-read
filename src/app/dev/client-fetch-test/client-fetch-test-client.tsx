"use client";

import { useState } from "react";
import Link from "next/link";
import { clientFetch } from "@/lib/client-fetch";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

export function ClientFetchTestClient() {
  const [log, setLog] = useState("");

  const append = (line: string) => {
    setLog((prev) => (prev ? `${prev}\n${line}` : line));
  };

  return (
    <div className="max-w-lg mx-auto p-6 space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-bold">clientFetch 调试</h1>
        <p className="text-sm text-muted-foreground">
          路由 <code className="rounded bg-muted px-1 py-0.5 text-xs">/dev/client-fetch-test</code>
          ，仅本地 development；应出现 Sonner toast。HTTP 错误不抛异常，网络错误会 throw。
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Button
          type="button"
          variant="destructive"
          onClick={async () => {
            append("→ GET /api/dev/client-fetch-test (500)");
            const r = await clientFetch("/api/dev/client-fetch-test");
            append(`← status=${r.status} ok=${r.ok}`);
          }}
        >
          HTTP 500 + toast
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={async () => {
            append("→ GET ?kind=401");
            const r = await clientFetch("/api/dev/client-fetch-test?kind=401");
            append(`← status=${r.status} ok=${r.ok}`);
          }}
        >
          HTTP 401 + toast
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={async () => {
            append("→ GET ?kind=404");
            const r = await clientFetch("/api/dev/client-fetch-test?kind=404");
            append(`← status=${r.status} ok=${r.ok}`);
          }}
        >
          HTTP 404 + toast
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={async () => {
            append("→ 连接被拒绝（127.0.0.1:1）");
            try {
              await clientFetch("http://127.0.0.1:1/nope");
              append("← 未抛错（意外）");
            } catch (e) {
              append(`← catch: ${e instanceof Error ? e.message : String(e)}`);
            }
          }}
        >
          网络错误 + toast
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={async () => {
            append("→ 500 且 showErrorToast: false（不应有 toast）");
            const r = await clientFetch("/api/dev/client-fetch-test", {
              showErrorToast: false,
            });
            append(`← status=${r.status} ok=${r.ok}`);
          }}
        >
          HTTP 500 静默（无 toast）
        </Button>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">日志</span>
          <Button type="button" variant="ghost" size="sm" onClick={() => setLog("")}>
            清空
          </Button>
        </div>
        <pre className="text-xs rounded-lg border bg-muted/40 p-3 min-h-[120px] whitespace-pre-wrap font-mono">
          {log || "点击按钮…"}
        </pre>
      </div>

      <Link href="/dashboard" className={cn(buttonVariants({ variant: "link" }), "px-0")}>
        回首页 / 仪表盘
      </Link>
    </div>
  );
}
