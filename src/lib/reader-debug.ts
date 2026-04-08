const KEY = "reader-debug";

/** 控制台执行 `localStorage.setItem("reader-debug", "1")` 后刷新即可打开；`removeItem` 关闭 */
export function isReaderDebug(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function readerDebugLog(message: string, ...args: unknown[]): void {
  if (!isReaderDebug()) return;
  console.log(`[ReaderDebug] ${message}`, ...args);
}
