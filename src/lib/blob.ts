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
 * 删除 Vercel Blob 文件（静默失败，不阻塞业务）
 */
export async function deleteBlob(url: string): Promise<void> {
  try {
    await del(url);
  } catch (error) {
    console.error("[Blob] Failed to delete:", url, error);
  }
}
