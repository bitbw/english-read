"use client";

import { useState, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, FileText, X, Loader2, ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { postCoverUpload } from "@/lib/post-cover-upload";
import {
  extractCoverFileFromEpubBook,
  type EpubBookForCover,
} from "@/lib/extract-epub-cover";
import { CLIENT_FETCH_NETWORK_ERROR, clientFetch } from "@/lib/client-fetch";

export function EpubUpload() {
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

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
      // Step 1: 上传文件到 Vercel Blob
      const formData = new FormData();
      formData.append("file", file);
      const uploadRes = await clientFetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      if (!uploadRes.ok) return;
      const { url, pathname, size } = await uploadRes.json();

      let coverUrl: string | undefined;
      if (coverFile) {
        try {
          const cover = await postCoverUpload(coverFile);
          coverUrl = cover.url;
        } catch (coverErr) {
          throw coverErr instanceof Error ? coverErr : new Error("封面上传失败");
        }
      }

      // Step 2: 从 EPUB 读元数据；未选手动封面时尝试解析内置封面
      let title = file.name.replace(/\.epub$/i, "");
      let author = "";
      try {
        const ePub = (await import("epubjs")).default;
        const book = ePub(url);
        await book.ready;
        const meta = await book.loaded.metadata;
        title = (meta as { title?: string }).title || title;
        author = (meta as { creator?: string }).creator || "";

        if (!coverUrl) {
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
        // 元数据读取失败时使用文件名
      }

      // Step 3: 创建书籍数据库记录
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
                <Button type="button" variant="ghost" size="sm" onClick={() => setCoverFile(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <Button type="button" variant="outline" size="sm" onClick={() => coverInputRef.current?.click()}>
                选择图片
              </Button>
            )}
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
    </div>
  );
}
