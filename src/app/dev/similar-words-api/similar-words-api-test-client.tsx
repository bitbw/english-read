"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DEFAULT_PHRASE_LLM_MODEL,
  formatPhraseLlmModelOptionLabel,
  PHRASE_LLM_MODEL_OPTIONS,
} from "@/lib/similar-words-llm-models";
import { cn } from "@/lib/utils";

const MODEL_STORAGE_KEY = "similar-words-dev-llm-model";

function readStoredModel(): string {
  if (typeof window === "undefined") return DEFAULT_PHRASE_LLM_MODEL;
  const stored = localStorage.getItem(MODEL_STORAGE_KEY);
  if (stored && PHRASE_LLM_MODEL_OPTIONS.some((m) => m.id === stored)) {
    return stored;
  }
  return DEFAULT_PHRASE_LLM_MODEL;
}

export function SimilarWordsApiTestClient() {
  const [word, setWord] = useState("");
  const [skipCache, setSkipCache] = useState(true);
  const [selectedModel, setSelectedModel] = useState(DEFAULT_PHRASE_LLM_MODEL);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<number | null>(null);
  const [bodyText, setBodyText] = useState("");

  useEffect(() => {
    setSelectedModel(readStoredModel());
  }, []);

  const modelLabels = useMemo(
    () =>
      PHRASE_LLM_MODEL_OPTIONS.map((model, index) => ({
        id: model.id,
        label: formatPhraseLlmModelOptionLabel(model, index + 1),
      })),
    []
  );

  const onModelChange = (value: string | null) => {
    if (!value) return;
    setSelectedModel(value);
    localStorage.setItem(MODEL_STORAGE_KEY, value);
  };

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
      const params = new URLSearchParams({ word: q, model: selectedModel });
      if (skipCache) params.set("nocache", "1");
      const url = `/api/review/similar-words?${params.toString()}`;
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
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="space-y-1">
        <h1 className="text-xl font-bold">similar-words API 调试</h1>
        <p className="text-sm text-muted-foreground">
          GET{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">
            /api/review/similar-words?word=…&amp;model=…
          </code>
          。仅本地 development；需已登录。短语请求会使用所选 Gateway Free Tier 模型。
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="similar-words-model">LLM 模型（按性价比排序）</Label>
          <Select value={selectedModel} onValueChange={onModelChange}>
            <SelectTrigger id="similar-words-model" className="h-auto min-h-8 w-full py-2">
              <SelectValue placeholder="选择模型" />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectGroup>
                <SelectLabel>Vercel AI Gateway · Free Tier</SelectLabel>
                {modelLabels.map((item) => (
                  <SelectItem key={item.id} value={item.id} className="whitespace-normal py-2">
                    {item.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            价格来自 Gateway Model List；~$/req 按典型 prompt ~320 tokens + 输出 ~160 tokens 估算。
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="similar-word-input">单词或短语</Label>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              id="similar-word-input"
              value={word}
              onChange={(e) => setWord(e.target.value)}
              placeholder="例如 apple / hand in / look forward to"
              onKeyDown={(e) => {
                if (e.key === "Enter") void run();
              }}
              className="sm:flex-1"
            />
            <Button type="button" onClick={() => void run()} disabled={loading}>
              {loading ? "请求中…" : "请求"}
            </Button>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={skipCache}
              onChange={(e) => setSkipCache(e.target.checked)}
              className="size-4 rounded border"
            />
            跳过缓存（nocache=1，每次重新请求 LLM）
          </label>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <span>
            <span className="font-medium">HTTP 状态 </span>
            <span className="text-muted-foreground">{status === null ? "—" : String(status)}</span>
          </span>
          <span>
            <span className="font-medium">当前模型 </span>
            <code className="rounded bg-muted px-1 py-0.5 text-xs">{selectedModel}</code>
          </span>
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
