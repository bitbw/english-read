"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BookOpen, Loader2, Search } from "lucide-react";
import { clientFetch } from "@/lib/client-fetch";
import { READING_TIERS, getTierLabel, type ReadingTierId } from "@/lib/reading-tiers";

type PublicItem = {
  id: string;
  title: string;
  author: string | null;
  coverUrl: string | null;
  blobUrl: string;
  tier: ReadingTierId;
  fileSize: number | null;
  createdAt: string;
  uploaderName: string | null;
};

export function PublicLibraryClient() {
  const [tier, setTier] = useState<ReadingTierId | "all">("all");
  const [q, setQ] = useState("");
  const [items, setItems] = useState<PublicItem[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (tier !== "all") params.set("tier", tier);
      if (q.trim()) params.set("q", q.trim());
      params.set("page", String(page));
      const res = await clientFetch(`/api/library/public?${params.toString()}`);
      if (!res.ok) return;
      const data = await res.json();
      setItems(data.items ?? []);
      setTotalPages(data.totalPages ?? 1);
    } finally {
      setLoading(false);
    }
  }, [tier, q, page]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant={tier === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => { setPage(1); setTier("all"); }}
          >
            全部
          </Button>
          {READING_TIERS.map((t) => (
            <Button
              key={t.id}
              type="button"
              variant={tier === t.id ? "default" : "outline"}
              size="sm"
              onClick={() => { setPage(1); setTier(t.id); }}
            >
              {t.label}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              className="pl-9"
              placeholder="搜索书名或作者"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setPage(1);
                  void loadList();
                }
              }}
            />
          </div>
          <Button type="button" variant="secondary" size="sm" onClick={() => { setPage(1); void loadList(); }}>
            搜索
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center text-muted-foreground">
            <BookOpen className="h-12 w-12 opacity-40" />
            <p>暂无书籍</p>
            {/* <p className="text-sm">点击上方「上传到书库」添加第一本吧</p> */}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-4">
          {items.map((item) => (
            <Link key={item.id} href={`/library/store/${item.id}`} className="block group min-w-0">
              <Card className="overflow-hidden py-0 h-full transition-colors hover:border-primary/40 hover:bg-muted/30">
                <CardContent className="p-2.5 sm:p-4">
                  <div className="w-full aspect-[2/3] rounded-md overflow-hidden mb-2 sm:mb-3 bg-gradient-to-br from-primary/10 to-primary/20 flex items-center justify-center">
                    {item.coverUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.coverUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <BookOpen className="h-8 w-8 sm:h-12 sm:w-12 text-primary/40" />
                    )}
                  </div>
                  <p
                    className="font-medium text-xs sm:text-sm line-clamp-1 leading-tight min-h-[1.25em] min-w-0 group-hover:text-primary"
                    title={item.title}
                  >
                    {item.title}
                  </p>
                  {item.author && (
                    <p className="text-[11px] sm:text-xs text-muted-foreground line-clamp-1 mt-0.5">{item.author}</p>
                  )}
                  <p className="text-[11px] sm:text-xs text-primary mt-1">{getTierLabel(item.tier)}</p>
                  {item.uploaderName && (
                    <p className="text-[10px] text-muted-foreground mt-1 truncate">上传：{item.uploaderName}</p>
                  )}
                  <p className="text-[10px] sm:text-[11px] text-muted-foreground mt-2">点击查看详情</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            上一页
          </Button>
          <span className="text-sm text-muted-foreground self-center tabular-nums">
            {page} / {totalPages}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            下一页
          </Button>
        </div>
      )}
    </div>
  );
}
