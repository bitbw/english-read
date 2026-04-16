"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BookOpen, ExternalLink, Loader2, Plus, Search, Upload } from "lucide-react";
import { buttonVariants } from "@/components/ui/button-variants";
import { toast } from "sonner";
import { upload } from "@vercel/blob/client";
import { clientFetch, CLIENT_FETCH_NETWORK_ERROR } from "@/lib/client-fetch";
import { READING_TIERS, getTierLabel, type ReadingTierId } from "@/lib/reading-tiers";
import { cn } from "@/lib/utils";

/** 站外电子书检索（英文 EPUB），供用户自行获取文件后再上传到书库 */
const EXTERNAL_EPUB_FIND_URL =
  "https://zh.dlc101.ru/s/Harry%20Potter/?languages%5B0%5D=english&extensions%5B0%5D=EPUB&selected_content_types%5B0%5D=book";

const MAX_EPUB_BYTES = 50 * 1024 * 1024;
const MULTIPART_THRESHOLD = 5 * 1024 * 1024;

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
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [tier, setTier] = useState<ReadingTierId | "all">("all");
  const [q, setQ] = useState("");
  const [items, setItems] = useState<PublicItem[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  /** publicBookId -> 个人 books.id */
  const [shelfByPublic, setShelfByPublic] = useState<Map<string, string>>(new Map());
  const [addingId, setAddingId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const loadShelfMap = useCallback(async () => {
    const res = await clientFetch("/api/books");
    if (!res.ok) return;
    const books = (await res.json()) as { id: string; publicBookId?: string | null }[];
    const map = new Map<string, string>();
    for (const b of books) {
      if (b.publicBookId) map.set(b.publicBookId, b.id);
    }
    setShelfByPublic(map);
  }, []);

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
    void loadShelfMap();
  }, [loadShelfMap]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  async function handleAdd(publicBookId: string) {
    setAddingId(publicBookId);
    try {
      const res = await clientFetch("/api/books/from-public", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicBookId }),
      });
      if (!res.ok) return;
      const data = (await res.json()) as { bookId: string; alreadyAdded?: boolean };
      setShelfByPublic((prev) => new Map(prev).set(publicBookId, data.bookId));
      if (data.alreadyAdded) {
        toast.info("本书已在你的书架中");
        router.push(`/read/${data.bookId}`);
      } else {
        toast.success("已加入书架");
        router.push(`/read/${data.bookId}`);
      }
    } catch (e) {
      if (e instanceof Error && e.message !== CLIENT_FETCH_NETWORK_ERROR) {
        toast.error(e.message);
      }
    } finally {
      setAddingId(null);
    }
  }

  async function handlePublicUpload(file: File) {
    if (!file.name.toLowerCase().endsWith(".epub")) {
      toast.error("请上传 .epub 文件");
      return;
    }
    if (file.size > MAX_EPUB_BYTES) {
      toast.error("文件不能超过 50MB");
      return;
    }
    setUploading(true);
    let title = file.name.replace(/\.epub$/i, "").replace(/[-_]/g, " ").trim();
    let author = "";
    try {
      try {
        const buf = await file.arrayBuffer();
        const ePub = (await import("epubjs")).default;
        const book = ePub(buf);
        await book.ready;
        const meta = await book.loaded.metadata;
        title = (meta as { title?: string }).title || title;
        author = (meta as { creator?: string }).creator || "";
        book.destroy();
      } catch {
        /* 元数据读取失败时使用文件名 */
      }

      const safeName = file.name.replace(/\s+/g, "-").replace(/[^\w\-_.]/g, "") || "book.epub";
      const pathname = `epubs/public/${Date.now()}-${safeName}`;

      const blobResult = await upload(pathname, file, {
        access: "public",
        handleUploadUrl: "/api/library/public/blob",
        contentType: "application/epub+zip",
        multipart: file.size >= MULTIPART_THRESHOLD,
      });

      const fin = await clientFetch("/api/library/public/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          blobUrl: blobResult.url,
          blobKey: blobResult.pathname,
          fileSize: file.size,
          title,
          ...(author.trim() ? { author: author.trim() } : {}),
        }),
      });
      if (!fin.ok) return;
      const data = (await fin.json()) as { tier: ReadingTierId };
      toast.success(`上传成功，已归入「${getTierLabel(data.tier)}」`);
      setPage(1);
      await loadShelfMap();
      await loadList();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "上传出错";
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  }

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

      <Card className="border-dashed">
        <CardContent className="flex flex-col gap-3 py-4">
          <p className="text-sm text-muted-foreground">
            还没有 EPUB？可先到外部站点搜索英文电子书，下载后再上传到书库。上传到公共书库后所有用户可见，系统将自动识别书名并分级。
          </p>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:justify-end">
            <a
              href={EXTERNAL_EPUB_FIND_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(buttonVariants({ variant: "outline" }), "w-full sm:w-auto justify-center")}
            >
              <ExternalLink className="h-4 w-4 mr-2 shrink-0" />
              去下载电子书
            </a>
            <div className="w-full sm:w-auto">
              <input
                ref={fileRef}
                type="file"
                accept=".epub"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) void handlePublicUpload(f);
                }}
              />
              <Button
                type="button"
                disabled={uploading}
                className="w-full sm:w-auto"
                onClick={() => fileRef.current?.click()}
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    上传中…
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    上传到书库
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex justify-center py-16 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center text-muted-foreground">
            <BookOpen className="h-12 w-12 opacity-40" />
            <p>暂无书籍</p>
            <p className="text-sm">上传第一本到公共书库吧</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-4">
          {items.map((item) => {
            const shelfId = shelfByPublic.get(item.id);
            const added = Boolean(shelfId);
            return (
              <Card key={item.id} className="overflow-hidden py-0">
                <CardContent className="p-2.5 sm:p-4">
                  <div className="w-full aspect-[2/3] rounded-md overflow-hidden mb-2 sm:mb-3 bg-gradient-to-br from-primary/10 to-primary/20 flex items-center justify-center">
                    {item.coverUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.coverUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <BookOpen className="h-8 w-8 sm:h-12 sm:w-12 text-primary/40" />
                    )}
                  </div>
                  <p className="font-medium text-xs sm:text-sm line-clamp-2 leading-tight">{item.title}</p>
                  {item.author && (
                    <p className="text-[11px] sm:text-xs text-muted-foreground line-clamp-1 mt-0.5">{item.author}</p>
                  )}
                  <p className="text-[11px] sm:text-xs text-primary mt-1">{getTierLabel(item.tier)}</p>
                  {item.uploaderName && (
                    <p className="text-[10px] text-muted-foreground mt-1 truncate">上传：{item.uploaderName}</p>
                  )}
                  <div className="mt-3">
                    <Button
                      type="button"
                      size="sm"
                      className="w-full"
                      variant={added ? "secondary" : "default"}
                      disabled={addingId === item.id}
                      onClick={() => {
                        if (added && shelfId) router.push(`/read/${shelfId}`);
                        else void handleAdd(item.id);
                      }}
                    >
                      {addingId === item.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : added ? (
                        "打开阅读"
                      ) : (
                        <>
                          <Plus className="h-4 w-4 mr-1" />
                          加入书架
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
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
