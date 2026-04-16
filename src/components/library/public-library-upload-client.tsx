"use client";

import { useRef, useState, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, ImageIcon, Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { upload } from "@vercel/blob/client";
import { clientFetch } from "@/lib/client-fetch";
import { getTierLabel, type ReadingTierId } from "@/lib/reading-tiers";
import {
  extractCoverFileFromEpubBook,
  type EpubBookForCover,
} from "@/lib/extract-epub-cover";
import { postCoverUpload } from "@/lib/post-cover-upload";

const MAX_EPUB_BYTES = 50 * 1024 * 1024;
const MULTIPART_THRESHOLD = 5 * 1024 * 1024;

export function PublicLibraryUploadClient() {
  const router = useRouter();
  const epubInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [epubFile, setEpubFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);

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
      router.push("/library/store");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "上传出错";
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="max-w-xl mx-auto w-full space-y-4">
      <Card
        className={`border-2 border-dashed p-12 text-center cursor-pointer transition-colors ${
          dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
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
  );
}
