"use client";

import { useEffect, useState } from "react";
import {
  extractCoverFileFromEpubBook,
  type EpubBookForCover,
} from "@/lib/extract-epub-cover";

/**
 * 选完本地 EPUB 后解析内嵌封面，生成 blob URL 供预览（与实际上传时的提取逻辑一致）。
 */
export function useEpubCoverPreview(epubFile: File | null) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (!epubFile) {
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      setLoading(false);
      return;
    }

    setLoading(true);
    (async () => {
      try {
        const buf = await epubFile.arrayBuffer();
        const ePub = (await import("epubjs")).default;
        const book = ePub(buf);
        await book.ready;
        const extracted = await extractCoverFileFromEpubBook(book as EpubBookForCover);
        book.destroy();
        if (cancelled || !extracted) return;
        const url = URL.createObjectURL(extracted);
        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }
        setPreviewUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return url;
        });
      } catch {
        if (!cancelled) {
          setPreviewUrl((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return null;
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    };
  }, [epubFile]);

  return { previewUrl, loading };
}
