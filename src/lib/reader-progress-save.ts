import { clientFetch } from "@/lib/client-fetch";

/** 将当前 CFI 与全书进度百分比写入服务端（失败静默）。 */
export function saveReadingProgressToServer(
  bookId: string,
  cfi: string,
  pct: number
): void {
  void clientFetch(`/api/books/${bookId}/progress`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    keepalive: true,
    body: JSON.stringify({
      currentCfi: cfi,
      readingProgress: Math.round(pct),
    }),
    showErrorToast: false,
  }).catch(() => {});
}
