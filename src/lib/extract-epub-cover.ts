"use client";

const COVER_MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

type ManifestItem = { href: string; type: string };

/** epubjs Book 实例在客户端解析封面所需的最小形状 */
export type EpubBookForCover = {
  archived: boolean;
  archive: {
    request: (url: string, type?: string) => Promise<unknown>;
  };
  packaging: { manifest: Record<string, ManifestItem> };
  coverUrl: () => Promise<string | null>;
  resolve: (path: string) => string | undefined;
};

function basename(p: string): string {
  const i = Math.max(p.lastIndexOf("/"), p.lastIndexOf("\\"));
  return i >= 0 ? p.slice(i + 1) : p;
}

function isCoverFilename(name: string): boolean {
  return /^cover\.(jpe?g|png|webp)$/i.test(name);
}

function extForMime(mime: string): string {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "jpg";
}

async function sniffMime(blob: Blob, filenameHint: string): Promise<string> {
  const fromType = blob.type?.split(";")[0]?.trim() ?? "";
  if (fromType && fromType !== "application/octet-stream") return fromType;

  const slice = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
  if (slice.length >= 3 && slice[0] === 0xff && slice[1] === 0xd8 && slice[2] === 0xff) {
    return "image/jpeg";
  }
  if (slice.length >= 8 && slice[0] === 0x89 && slice[1] === 0x50 && slice[2] === 0x4e && slice[3] === 0x47) {
    return "image/png";
  }
  if (
    slice.length >= 12 &&
    slice[0] === 0x52 &&
    slice[1] === 0x49 &&
    slice[2] === 0x46 &&
    slice[3] === 0x46 &&
    slice[8] === 0x57 &&
    slice[9] === 0x45 &&
    slice[10] === 0x42 &&
    slice[11] === 0x50
  ) {
    return "image/webp";
  }

  const m = filenameHint.match(/\.(jpe?g|png|webp)$/i);
  if (m) {
    const e = m[1].toLowerCase();
    if (e === "png") return "image/png";
    if (e === "webp") return "image/webp";
    return "image/jpeg";
  }
  return "";
}

async function blobToCoverFile(blob: Blob, filenameHint: string): Promise<File | null> {
  const mime = await sniffMime(blob, filenameHint);
  if (!ALLOWED_MIME.has(mime)) return null;
  if (blob.size > COVER_MAX_BYTES) return null;
  const ext = extForMime(mime);
  const base = basename(filenameHint).replace(/\.[^.]+$/, "") || "cover";
  return new File([blob], `${base}.${ext}`, { type: mime });
}

async function fetchObjectUrlAsCoverFile(objectUrl: string, filenameHint: string): Promise<File | null> {
  const res = await fetch(objectUrl);
  if (!res.ok) return null;
  const blob = await res.blob();
  return blobToCoverFile(blob, filenameHint);
}

/**
 * 在 book.ready 之后调用：标准 OPF 封面（epubjs coverUrl）或 manifest 中 cover.jpg|png|webp 回退。
 */
export async function extractCoverFileFromEpubBook(book: EpubBookForCover): Promise<File | null> {
  if (!book.archived || !book.archive) return null;

  try {
    const coverObjectUrl = await book.coverUrl();
    if (coverObjectUrl) {
      const file = await fetchObjectUrlAsCoverFile(coverObjectUrl, "cover.jpg");
      if (file) return file;
    }
  } catch {
    /* 无封面或解析失败则尝试回退 */
  }

  const manifest = book.packaging?.manifest;
  if (!manifest || typeof manifest !== "object") return null;

  const candidates: { id: string; href: string; score: number }[] = [];
  for (const [id, item] of Object.entries(manifest)) {
    if (!item?.href || !item.type?.startsWith?.("image/")) continue;
    if (!isCoverFilename(basename(item.href))) continue;
    let score = 10;
    if (id.toLowerCase() === "cover") score += 5;
    if (/\.jpe?g$/i.test(item.href)) score += 1;
    candidates.push({ id, href: item.href, score });
  }
  candidates.sort((a, b) => b.score - a.score);

  for (const c of candidates) {
    const resolved = book.resolve(c.href);
    if (!resolved) continue;
    try {
      const raw = await book.archive.request(resolved, "blob");
      if (!(raw instanceof Blob)) continue;
      const file = await blobToCoverFile(raw, basename(c.href));
      if (file) return file;
    } catch {
      /* 尝试下一候选 */
    }
  }

  return null;
}
