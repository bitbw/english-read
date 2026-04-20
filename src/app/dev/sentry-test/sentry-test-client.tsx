"use client";

import * as Sentry from "@sentry/nextjs";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

export function SentryTestClient() {
  const [log, setLog] = useState("");

  const append = (line: string) => {
    setLog((prev) => (prev ? `${prev}\n${line}` : line));
  };

  return (
    <div className="mx-auto max-w-lg space-y-6 p-6">
      <div className="space-y-1">
        <h1 className="text-xl font-bold">Sentry 上报测试</h1>
        <p className="text-sm text-muted-foreground">
          仅本地 development。在 Sentry 项目里应能看到对应 issue（可能有数秒延迟）。
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">浏览器端（SDK）</p>
        <div className="flex flex-col gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              const eventId = Sentry.captureMessage(
                "Sentry client captureMessage test (english-read dev)",
                "info",
              );
              append(`captureMessage → eventId=${String(eventId)}`);
            }}
          >
            captureMessage（info）
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              const eventId = Sentry.captureException(
                new Error("Sentry client captureException test (english-read dev)"),
              );
              append(`captureException → eventId=${String(eventId)}`);
            }}
          >
            captureException
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => {
              append("未捕获异常（将交给 Sentry 默认处理，并可能看到 Next 错误页）…");
              throw new Error("Sentry client uncaught test (english-read dev)");
            }}
          >
            抛出未捕获异常
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">服务端（Route Handler）</p>
        <div className="flex flex-col gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={async () => {
              append("→ GET /api/dev/sentry-test");
              const r = await fetch("/api/dev/sentry-test");
              append(`← ${r.status} ${await r.text()}`);
            }}
          >
            服务端 captureException（API）
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={async () => {
              append("→ GET /api/dev/sentry-test?throw=1");
              const r = await fetch("/api/dev/sentry-test?throw=1");
              append(`← ${r.status} ${await r.text()}`);
            }}
          >
            服务端抛错（API 500）
          </Button>
        </div>
      </div>

      {log ? (
        <pre className="whitespace-pre-wrap rounded-md border bg-muted/50 p-3 text-xs">{log}</pre>
      ) : null}

      <Link
        href="/dev"
        className={cn(buttonVariants({ variant: "link" }), "inline h-auto p-0")}
      >
        ← 开发工具
      </Link>
    </div>
  );
}
