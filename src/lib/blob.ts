import { del, put } from "@vercel/blob";

/**
 * 上传 EPUB 文件到 Vercel Blob
 */
export async function uploadEpub(
  userId: string,
  file: File
): Promise<{ url: string; pathname: string }> {
  const safeName = encodeURIComponent(file.name.replace(/\s+/g, "-"));
  const pathname = `epubs/${userId}/${Date.now()}-${safeName}`;
  const blob = await put(pathname, file, {
    access: "public",
    contentType: "application/epub+zip",
  });
  return { url: blob.url, pathname: blob.pathname };
}

/**
 * 公共书库 EPUB（全员可读链接，路径前缀 epubs/public/）
 */
export async function uploadPublicEpub(file: File): Promise<{ url: string; pathname: string }> {
  const safeName = file.name.replace(/\s+/g, "-").replace(/[^\w\-_.]/g, "") || "book.epub";
  const pathname = `epubs/public/${Date.now()}-${safeName}`;
  const blob = await put(pathname, file, {
    access: "public",
    contentType: "application/epub+zip",
  });
  return { url: blob.url, pathname: blob.pathname };
}

const COVER_MAX_BYTES = 5 * 1024 * 1024;
const COVER_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

/**
 * 上传书籍封面到 Vercel Blob（JPEG / PNG / WebP，最大 5MB）
 */
export async function uploadCover(
  userId: string,
  file: File
): Promise<{ url: string; pathname: string }> {
  if (!COVER_TYPES.has(file.type)) {
    throw new Error("封面仅支持 JPG、PNG、WebP");
  }
  if (file.size > COVER_MAX_BYTES) {
    throw new Error("封面文件不能超过 5MB");
  }
  const ext =
    file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const pathname = `covers/${userId}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
  const blob = await put(pathname, file, {
    access: "public",
    contentType: file.type,
  });
  return { url: blob.url, pathname: blob.pathname };
}

const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
const AVATAR_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

/**
 * 上传用户头像到 Vercel Blob（JPEG / PNG / WebP，最大 2MB）
 */
export async function uploadAvatar(
  userId: string,
  file: File
): Promise<{ url: string; pathname: string }> {
  if (!AVATAR_TYPES.has(file.type)) {
    throw new Error("头像仅支持 JPG、PNG、WebP");
  }
  if (file.size > AVATAR_MAX_BYTES) {
    throw new Error("头像文件不能超过 2MB");
  }
  const ext =
    file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const pathname = `avatars/${userId}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
  const blob = await put(pathname, file, {
    access: "public",
    contentType: file.type,
  });
  return { url: blob.url, pathname: blob.pathname };
}

/**
 * 删除 Vercel Blob 文件（静默失败，不阻塞业务）
 */
export async function deleteBlob(url: string): Promise<void> {
  try {
    await del(url);
  } catch (error) {
    console.error("[Blob] Failed to delete:", url, error);
  }
}
