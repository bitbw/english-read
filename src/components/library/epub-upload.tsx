"use client";

import { useState, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, FileText, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export function EpubUpload() {
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
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
      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      if (!uploadRes.ok) {
        const err = await uploadRes.json();
        throw new Error(err.error ?? "上传失败");
      }
      const { url, pathname, size } = await uploadRes.json();

      // Step 2: 尝试从 EPUB 读取元数据
      let title = file.name.replace(/\.epub$/i, "");
      let author = "";
      try {
        const ePub = (await import("epubjs")).default;
        const book = ePub(url);
        await book.ready;
        const meta = await book.loaded.metadata;
        title = (meta as { title?: string }).title || title;
        author = (meta as { creator?: string }).creator || "";
        book.destroy();
      } catch {
        // 元数据读取失败时使用文件名
      }

      // Step 3: 创建书籍数据库记录
      const bookRes = await fetch("/api/books", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, author, blobUrl: url, blobKey: pathname, fileSize: size }),
      });
      if (!bookRes.ok) throw new Error("书籍创建失败");
      const book = await bookRes.json();

      toast.success(`《${title}》上传成功！`);
      router.push(`/read/${book.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "上传出错，请重试");
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
