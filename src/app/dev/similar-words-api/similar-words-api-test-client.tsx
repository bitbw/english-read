"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function SimilarWordsApiTestClient() {
  const [word, setWord] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<number | null>(null);
  const [bodyText, setBodyText] = useState("");

  const run = async () => {
    const q = word.trim();
    if (!q) {
      setStatus(null);
      setBodyText("请输入单词或短语。");
      return;
    }
    setLoading(true);
    setStatus(null);
    setBodyText("");
    try {
      const url = `/api/review/similar-words?word=${encodeURIComponent(q)}`;
      const res = await fetch(url, { method: "GET" });
      setStatus(res.status);
      const text = await res.text();
      try {
        setBodyText(JSON.stringify(JSON.parse(text), null, 2));
      } catch {
        setBodyText(text || "(空响应体)");
      }
    } catch (e) {
      setStatus(null);
      setBodyText(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div className="space-y-1">
        <h1 className="text-xl font-bold">similar-words API 调试</h1>
        <p className="text-sm text-muted-foreground">
          GET{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">/api/review/similar-words?word=…</code>
          。仅本地 development；需已登录，否则返回 401。
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="similar-word-input">单词或短语</Label>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            id="similar-word-input"
            value={word}
            onChange={(e) => setWord(e.target.value)}
            placeholder="例如 apple / look up / 任意短语"
            onKeyDown={(e) => {
              if (e.key === "Enter") void run();
            }}
            className="sm:flex-1"
          />
          <Button type="button" onClick={() => void run()} disabled={loading}>
            {loading ? "请求中…" : "请求"}
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-medium">HTTP 状态</span>
          <span className="text-muted-foreground">{status === null ? "—" : String(status)}</span>
        </div>
        <pre className="min-h-[200px] whitespace-pre-wrap rounded-lg border bg-muted/40 p-3 font-mono text-xs">
          {bodyText || "点击「请求」查看 JSON。"}
        </pre>
      </div>

      <Link href="/dev" className={cn(buttonVariants({ variant: "link" }), "px-0")}>
        返回开发工具
      </Link>
    </div>
  );
}
