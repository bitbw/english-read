"use client";

import { useCallback, useEffect, useRef, useState, type DragEvent } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  BookOpen,
  ExternalLink,
  FileText,
  ImageIcon,
  Loader2,
  Search,
  Upload,
  X,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button-variants";
import { toast } from "sonner";
import { upload } from "@vercel/blob/client";
import { clientFetch } from "@/lib/client-fetch";
import { READING_TIERS, getTierLabel, type ReadingTierId } from "@/lib/reading-tiers";
import {
  extractCoverFileFromEpubBook,
  type EpubBookForCover,
} from "@/lib/extract-epub-cover";
import { postCoverUpload } from "@/lib/post-cover-upload";
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
  const epubInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [epubFile, setEpubFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [tier, setTier] = useState<ReadingTierId | "all">("all");
  const [q, setQ] = useState("");
  const [items, setItems] = useState<PublicItem[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

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

  function handleEpubDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped?.name.toLowerCase().endsWith(".epub")) {
      setEpubFile(dropped);
    } else {
      toast.error("请上传 .epub 格式的文件");
    }
  }

  function handleEpubFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (selected?.name.toLowerCase().endsWith(".epub")) {
      setEpubFile(selected);
    } else if (selected) {
      toast.error("请上传 .epub 格式的文件");
    }
  }

  async function handlePublicUpload() {
    const file = epubFile;
    if (!file) {
      toast.error("请先选择 EPUB 文件");
      return;
    }
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
    let coverUrl: string | undefined;
    try {
      /**
       * 公共书库上传流程（大文件不经由 Next body，避免 413）：
       * 1) 本地 ArrayBuffer + ePub(buf) 读书名/作者；destroy 前处理封面（手动优先，否则内嵌提取）。
       * 2) @vercel/blob/client 直传 EPUB 到存储（multipart 阈值以上走分片）。
       * 3) POST /api/library/public/finalize 提交 blobUrl、blobKey、元数据、封面 URL，服务端 LLM 分级并写入 public_library_books。
       */
      try {
        const buf = await file.arrayBuffer();
        const ePub = (await import("epubjs")).default;
        const book = ePub(buf);
        await book.ready;
        const meta = await book.loaded.metadata;
        title = (meta as { title?: string }).title || title;
        author = (meta as { creator?: string }).creator || "";

        if (coverFile) {
          try {
            const cover = await postCoverUpload(coverFile);
            coverUrl = cover.url;
          } catch (coverErr) {
            throw coverErr instanceof Error ? coverErr : new Error("封面上传失败");
          }
        } else {
          try {
            const extracted = await extractCoverFileFromEpubBook(book as EpubBookForCover);
            if (extracted) {
              const cover = await postCoverUpload(extracted);
              coverUrl = cover.url;
            }
          } catch {
            /* 无可用封面或上传失败则略过 */
          }
        }

        book.destroy();
      } catch {
        if (coverFile) {
          try {
            const cover = await postCoverUpload(coverFile);
            coverUrl = cover.url;
          } catch (coverErr) {
            throw coverErr instanceof Error ? coverErr : new Error("封面上传失败");
          }
        }
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
          ...(coverUrl ? { coverUrl } : {}),
        }),
      });
      if (!fin.ok) return;
      const data = (await fin.json()) as { tier: ReadingTierId };
      toast.success(`上传成功，已归入「${getTierLabel(data.tier)}」`);
      setEpubFile(null);
      setCoverFile(null);
      setPage(1);
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

      <div className="max-w-xl mx-auto w-full space-y-4">
        <p className="text-sm text-muted-foreground text-center sm:text-left">
          还没有 EPUB？可先到外部站点查找。上传到公共书库后所有用户可见，系统将自动识别书名并分级。
        </p>
        <div className="flex flex-col sm:flex-row gap-2 sm:justify-center">
          <a
            href={EXTERNAL_EPUB_FIND_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(buttonVariants({ variant: "outline" }), "w-full sm:w-auto justify-center")}
          >
            <ExternalLink className="h-4 w-4 mr-2 shrink-0" />
            去下载电子书
          </a>
        </div>

        <Card
          className={`border-2 border-dashed p-12 text-center cursor-pointer transition-colors ${
            dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
          }`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleEpubDrop}
          onClick={() => !epubFile && !uploading && epubInputRef.current?.click()}
        >
          <input
            ref={epubInputRef}
            type="file"
            accept=".epub"
            className="hidden"
            onChange={handleEpubFileChange}
          />
          {epubFile ? (
            <div className="flex flex-col items-center gap-3">
              <FileText className="h-12 w-12 text-primary" />
              <div>
                <p className="font-medium">{epubFile.name}</p>
                <p className="text-sm text-muted-foreground">
                  {(epubFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={uploading}
                onClick={(e) => {
                  e.stopPropagation();
                  setEpubFile(null);
                }}
              >
                <X className="h-4 w-4 mr-1" />
                重新选择
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <Upload className="h-12 w-12 text-muted-foreground" />
              <div>
                <p className="font-medium">拖拽 EPUB 到此处</p>
                <p className="text-sm text-muted-foreground mt-1">或点击选择 · 最大 50MB</p>
              </div>
            </div>
          )}
        </Card>

        <Card className="p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-sm">
              <ImageIcon className="h-4 w-4 text-muted-foreground shrink-0" />
              <div>
                <p className="font-medium">封面（可选）</p>
                <p className="text-xs text-muted-foreground">
                  JPG / PNG / WebP，最大 5MB；不选时将尝试从 EPUB 内嵌封面提取
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                ref={coverInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) setCoverFile(f);
                }}
              />
              {coverFile ? (
                <>
                  <span className="text-xs text-muted-foreground truncate max-w-[140px]">{coverFile.name}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={uploading}
                    onClick={() => setCoverFile(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={uploading}
                  onClick={() => coverInputRef.current?.click()}
                >
                  选择图片
                </Button>
              )}
            </div>
          </div>
        </Card>

        <Button
          type="button"
          className="w-full"
          disabled={!epubFile || uploading}
          onClick={() => void handlePublicUpload()}
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
          {items.map((item) => (
            <Link key={item.id} href={`/library/store/${item.id}`} className="block group">
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
                  <p className="font-medium text-xs sm:text-sm line-clamp-2 leading-tight group-hover:text-primary">
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
