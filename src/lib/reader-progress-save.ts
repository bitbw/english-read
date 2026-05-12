import { clientFetch } from "@/lib/client-fetch";

/**
 * 将当前 CFI（及可选的全书进度百分比）写入服务端（失败静默）。
 * 省略 `readingProgress` 时仅更新锚点，不覆盖库里的阅读百分比（供 locations 未生成前使用）。
 */
export function saveReadingProgressToServer(
  bookId: string,
  cfi: string,
  readingProgress?: number
): void {
  const body: { currentCfi: string; readingProgress?: number } = {
    currentCfi: cfi,
  };
  if (readingProgress !== undefined) {
    body.readingProgress = Math.round(readingProgress);
  }
  void clientFetch(`/api/books/${bookId}/progress`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    keepalive: true,
    body: JSON.stringify(body),
    showErrorToast: false,
  }).catch(() => {});
}
