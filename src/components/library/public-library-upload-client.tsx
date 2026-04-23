"use client";

import { useEffect, useRef, useState, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, ImageIcon, Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { upload } from "@vercel/blob/client";
import { clientFetch } from "@/lib/client-fetch";
import type { ReadingTierId } from "@/lib/reading-tiers";
import {
  extractCoverFileFromEpubBook,
  type EpubBookForCover,
} from "@/lib/extract-epub-cover";
import { postCoverUpload } from "@/lib/post-cover-upload";
import { useEpubCoverPreview } from "@/hooks/use-epub-cover-preview";
import { useTranslations } from "next-intl";

const MAX_EPUB_BYTES = 50 * 1024 * 1024;
const MULTIPART_THRESHOLD = 5 * 1024 * 1024;

export function PublicLibraryUploadClient() {
  const t = useTranslations("upload");
  const tLibrary = useTranslations("library");
  const router = useRouter();
  const epubInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [epubFile, setEpubFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverManualPreviewSrc, setCoverManualPreviewSrc] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const { previewUrl: epubEmbeddedPreviewUrl, loading: epubCoverLoading } =
    useEpubCoverPreview(epubFile);

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

  function handleEpubDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped?.name.toLowerCase().endsWith(".epub")) {
      setEpubFile(dropped);
    } else {
      toast.error(t("invalidFormat"));
    }
  }

  function handleEpubFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (selected?.name.toLowerCase().endsWith(".epub")) {
      setEpubFile(selected);
    } else if (selected) {
      toast.error(t("invalidFormat"));
    }
  }

  async function handlePublicUpload() {
    const file = epubFile;
    if (!file) {
      toast.error(t("selectEpubFirst"));
      return;
    }
    if (!file.name.toLowerCase().endsWith(".epub")) {
      toast.error(t("epubFormatRequired"));
      return;
    }
    if (file.size > MAX_EPUB_BYTES) {
      toast.error(t("fileTooLarge"));
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
            throw coverErr instanceof Error ? coverErr : new Error(t("coverUploadFailed"));
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
            throw coverErr instanceof Error ? coverErr : new Error(t("coverUploadFailed"));
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
      toast.success(
        t("uploadPublicSuccess", { tier: tLibrary(`readingTier.${data.tier}`) })
      );
      router.push("/library/store");
    } catch (e) {
      const msg = e instanceof Error ? e.message : t("uploadError");
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
              {t("reselect")}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <Upload className="h-12 w-12 text-muted-foreground" />
            <div>
              <p className="font-medium">{t("dropEpubShort")}</p>
              <p className="text-sm text-muted-foreground mt-1">{t("clickToSelectShort")}</p>
            </div>
          </div>
        )}
      </Card>

      <Card className="p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
          <div className="flex items-start gap-2 text-sm min-w-0">
            <ImageIcon className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">{t("coverOptional")}</p>
              <p className="text-xs text-muted-foreground">
                {t("coverHint")}
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
                <span className="text-xs text-muted-foreground px-2">{t("clickSelectCover")}</span>
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
              <span className="text-xs text-muted-foreground">{t("embeddedCover")}</span>
            ) : epubCoverLoading ? (
              <span className="text-xs text-muted-foreground">{t("readingCover")}</span>
            ) : null}
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
            {t("uploading")}
          </>
        ) : (
          <>
            <Upload className="h-4 w-4 mr-2" />
            {t("uploadToLibrary")}
          </>
        )}
      </Button>
    </div>
  );
}
