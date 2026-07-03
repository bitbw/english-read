"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, ExternalLink } from "lucide-react";
import { format } from "date-fns";

interface ScrapeResult {
  scraped: number;
  errors: number;
  total: number;
}

interface Article {
  id: string;
  title: string;
  description: string | null;
  coverUrl: string | null;
  wordCount: number | null;
  publishedAt: string | null;
  createdAt: string;
  level: number;
}

export default function DevScrapePage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScrapeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [articles, setArticles] = useState<Article[]>([]);
  const [articlesLoading, setArticlesLoading] = useState(false);
  const [levelFilter, setLevelFilter] = useState<number>(0); // 0 = 全部

  async function handleScrape() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/cron/scrape-articles");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const data: ScrapeResult = await res.json();
      setResult(data);
      fetchArticles();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "未知错误");
    } finally {
      setLoading(false);
    }
  }

  async function fetchArticles(lvl?: number) {
    const targetLevel = lvl ?? levelFilter;
    setArticlesLoading(true);
    try {
      if (targetLevel === 0) {
        // 全部：合并三个等级
        const results = await Promise.all(
          [1, 2, 3].map((l) =>
            fetch(`/api/articles?level=${l}&pageSize=5`).then((r) => r.json())
          )
        );
        const merged = results
          .flatMap((r) => r.items ?? [])
          .sort(
            (a: Article, b: Article) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
        setArticles(merged);
      } else {
        const res = await fetch(`/api/articles?level=${targetLevel}&pageSize=10`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setArticles(data.items ?? []);
      }
    } catch {
      // ignore
    } finally {
      setArticlesLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 max-w-3xl mx-auto p-6">
      <div>
        <h1 className="text-xl font-bold">爬取每日文章</h1>
        <p className="text-sm text-muted-foreground">手动触发 Level Read 文章爬取并查看结果</p>
      </div>

      <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-sm">Level 1 ~ 3</p>
            <p className="text-xs text-muted-foreground">
              从 levelread.com/news/level-{'{1,2,3}'} 抓取三个等级的最新文章
            </p>
          </div>
          <Button onClick={handleScrape} disabled={loading} size="sm">
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                爬取中...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" />
                执行爬取
              </>
            )}
          </Button>
        </div>

        {error && (
          <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}
        {result && (
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-muted px-3 py-2 text-center">
              <p className="text-lg font-bold text-emerald-600">{result.scraped}</p>
              <p className="text-xs text-muted-foreground">成功</p>
            </div>
            <div className="rounded-lg bg-muted px-3 py-2 text-center">
              <p className="text-lg font-bold text-amber-600">{result.errors}</p>
              <p className="text-xs text-muted-foreground">失败</p>
            </div>
            <div className="rounded-lg bg-muted px-3 py-2 text-center">
              <p className="text-lg font-bold text-foreground">{result.total}</p>
              <p className="text-xs text-muted-foreground">总数</p>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <p className="font-semibold text-sm">数据库中的文章</p>
          <Button variant="outline" size="sm" onClick={() => fetchArticles()} disabled={articlesLoading}>
            <RefreshCw className={`h-3 w-3 mr-1 ${articlesLoading ? "animate-spin" : ""}`} />
            刷新
          </Button>
        </div>

        {/* Level filter tabs */}
        <div className="flex gap-1">
          {[
            { value: 0, label: "全部" },
            { value: 1, label: "Level 1" },
            { value: 2, label: "Level 2" },
            { value: 3, label: "Level 3" },
          ].map((tab) => (
            <button
              key={tab.value}
              onClick={() => {
                setLevelFilter(tab.value);
                fetchArticles(tab.value);
              }}
              className={`px-3 py-1 text-xs rounded-full transition-colors ${
                levelFilter === tab.value
                  ? "bg-foreground text-background font-medium"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {articles.length === 0 && !articlesLoading && (
          <p className="text-sm text-muted-foreground py-4 text-center">
            暂无文章，点击上方按钮爬取
          </p>
        )}
        {articlesLoading && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
        {articles.length > 0 && (
          <div className="flex flex-col gap-2">
            {articles.map((a) => (
              <a
                key={a.id}
                href={`/articles/${a.id}`}
                className="flex items-start gap-3 rounded-lg border border-border/50 p-3 hover:bg-accent/50 transition-colors"
                target="_blank"
                rel="noopener"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{a.title}</p>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {a.description || "无描述"}
                  </p>
                  <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground">
                    <span>Level {a.level}</span>
                    {a.publishedAt && (
                      <>
                        <span>·</span>
                        <span>{format(new Date(a.publishedAt), "yyyy/MM/dd")}</span>
                      </>
                    )}
                    {a.wordCount && (
                      <>
                        <span>·</span>
                        <span>{a.wordCount} words</span>
                      </>
                    )}
                  </div>
                </div>
                <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}