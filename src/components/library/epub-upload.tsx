"use client";

import { useState, useRef, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, FileText, X, Loader2, ImageIcon, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { postCoverUpload } from "@/lib/post-cover-upload";
import {
  extractCoverFileFromEpubBook,
  type EpubBookForCover,
} from "@/lib/extract-epub-cover";
import { CLIENT_FETCH_NETWORK_ERROR, clientFetch } from "@/lib/client-fetch";
import { EXTERNAL_EPUB_FIND_URL } from "@/lib/external-epub-find";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import { useEpubCoverPreview } from "@/hooks/use-epub-cover-preview";

export function EpubUpload() {
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverManualPreviewSrc, setCoverManualPreviewSrc] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const { previewUrl: epubEmbeddedPreviewUrl, loading: epubCoverLoading } =
    useEpubCoverPreview(file);

  useEffect(() => {
    if (!coverFile) {
      setCoverManualPreviewSrc(null);
      return;
    }
    const url = URL.createObjectURL(coverFile);
    setCoverManualPreviewSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [coverFile]);

  const coverDisplaySrc = coverFile ? coverManualPreviewSrc : epubEmbeddedPreviewUrl;

  function clearCoverSelection() {
    setCoverFile(null);
    if (coverInputRef.current) coverInputRef.current.value = "";
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped?.name.endsWith(".epub")) {
      setFile(dropped);
    } else {
      toast.error("请上传 .epub 格式的文件");
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (selected?.name.endsWith(".epub")) {
      setFile(selected);
    } else {
      toast.error("请上传 .epub 格式的文件");
    }
  }

  async function handleUpload() {
    if (!file) return;
    setUploading(true);

    try {
      /**
       * 私有上传流程（避免「先上传再用 Blob URL 打开 epubjs」多一次整书 HTTP 下载）：
       * 1) 本地 file → ArrayBuffer，ePub(buf) 解析元数据；在 book.destroy 前处理封面。
       * 2) 选手动封面则只上传用户图；否则从 EPUB 内嵌提取再上传。
       * 3) 再 POST /api/upload 把 EPUB 传到 Blob。
       * 4) POST /api/books 写入个人书架。
       */
      let title = file.name.replace(/\.epub$/i, "");
      let author = "";
      let coverUrl: string | undefined;

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
        /* 否则仅保留默认 title（文件名），author 为空 */
      }

      const formData = new FormData();
      formData.append("file", file);
      const uploadRes = await clientFetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      if (!uploadRes.ok) return;
      const { url, pathname, size } = await uploadRes.json();

      const bookRes = await clientFetch("/api/books", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          author,
          blobUrl: url,
          blobKey: pathname,
          fileSize: size,
          ...(coverUrl ? { coverUrl } : {}),
        }),
      });
      if (!bookRes.ok) return;
      const book = await bookRes.json();

      toast.success(`《${title}》上传成功！`);
      router.push(`/read/${book.id}`);
    } catch (err) {
      if (err instanceof Error && err.message === CLIENT_FETCH_NETWORK_ERROR) {
        /* clientFetch 已 toast */
      } else {
        toast.error(err instanceof Error ? err.message : "上传出错，请重试");
      }
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="max-w-xl mx-auto space-y-4">
      {/* 拖拽区域 */}
      <Card
        className={`border-2 border-dashed p-12 text-center cursor-pointer transition-colors ${
          dragging
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50"
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => !file && inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".epub"
          className="hidden"
          onChange={handleFileChange}
        />
        {file ? (
          <div className="flex flex-col items-center gap-3">
            <FileText className="h-12 w-12 text-primary" />
            <div>
              <p className="font-medium">{file.name}</p>
              <p className="text-sm text-muted-foreground">
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => { e.stopPropagation(); setFile(null); }}
            >
              <X className="h-4 w-4 mr-1" />
              重新选择
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <Upload className="h-12 w-12 text-muted-foreground" />
            <div>
              <p className="font-medium">拖拽 EPUB 文件到此处</p>
              <p className="text-sm text-muted-foreground mt-1">
                或点击选择文件 · 最大 50MB
              </p>
            </div>
          </div>
        )}
      </Card>

      <Card className="p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
          <div className="flex items-start gap-2 text-sm min-w-0">
            <ImageIcon className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">封面（可选）</p>
              <p className="text-xs text-muted-foreground">
                选书后会自动显示内嵌封面；也可手动替换为 JPG / PNG / WebP（最大 5MB）
              </p>
            </div>
          </div>
          <div className="flex flex-col items-center gap-2 shrink-0 sm:items-end mx-auto sm:mx-0">
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
            <button
              type="button"
              disabled={uploading}
              onClick={() => coverInputRef.current?.click()}
              className="relative w-28 aspect-2/3 rounded-md border border-dashed border-border bg-muted/30 overflow-hidden flex items-center justify-center text-center transition-colors hover:bg-muted/50 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {coverDisplaySrc ? (
                // eslint-disable-next-line @next/next/no-img-element -- 本地 blob 预览
                <img src={coverDisplaySrc} alt="" className="absolute inset-0 w-full h-full object-cover" />
              ) : epubCoverLoading ? (
                <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" aria-hidden />
              ) : (
                <span className="text-xs text-muted-foreground px-2">点击选择封面</span>
              )}
            </button>
            {coverFile ? (
              <div className="flex items-center gap-1 max-w-44">
                <span className="text-xs text-muted-foreground truncate" title={coverFile.name}>
                  {coverFile.name}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 shrink-0"
                  disabled={uploading}
                  onClick={clearCoverSelection}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : epubEmbeddedPreviewUrl ? (
              <span className="text-xs text-muted-foreground">内嵌封面</span>
            ) : epubCoverLoading ? (
              <span className="text-xs text-muted-foreground">正在读取封面…</span>
            ) : null}
          </div>
        </div>
      </Card>

      <Button
        className="w-full"
        disabled={!file || uploading}
        onClick={handleUpload}
      >
        {uploading ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            上传中...
          </>
        ) : (
          "上传并开始阅读"
        )}
      </Button>

      <p className="text-sm text-muted-foreground max-w-xl text-left">
        还没有 EPUB？可先到外部站点查找。
      </p>
      <div className="flex justify-start">
        <a
          href={EXTERNAL_EPUB_FIND_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(buttonVariants({ variant: "outline" }), "justify-center")}
        >
          <ExternalLink className="h-4 w-4 mr-2 shrink-0" />
          去下载电子书
        </a>
      </div>
    </div>
  );
}
