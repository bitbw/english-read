/**
 * 阅读器布局模式：横翻分页 vs 竖滚按章（epubjs scrolled-doc）。
 */

export type ReaderLayoutMode = "paginated" | "scrolled-doc";

export const READER_LAYOUT_MODE_STORAGE_KEY = "english-read-reader-layout-mode";
export const DEFAULT_LAYOUT_MODE: ReaderLayoutMode = "paginated";

const LAYOUT_MODE_IDS: ReaderLayoutMode[] = ["paginated", "scrolled-doc"];

export function isReaderLayoutMode(value: string): value is ReaderLayoutMode {
  return (LAYOUT_MODE_IDS as string[]).includes(value);
}

export function readLayoutModeFromStorage(): ReaderLayoutMode {
  if (typeof window === "undefined") return DEFAULT_LAYOUT_MODE;
  try {
    const raw = localStorage.getItem(READER_LAYOUT_MODE_STORAGE_KEY);
    if (raw && isReaderLayoutMode(raw)) return raw;
  } catch {
    /* ignore */
  }
  return DEFAULT_LAYOUT_MODE;
}

export function writeLayoutModeToStorage(mode: ReaderLayoutMode): void {
  try {
    localStorage.setItem(READER_LAYOUT_MODE_STORAGE_KEY, mode);
  } catch {
    /* ignore */
  }
}

/** epubjs `renderTo` / `rendition.flow` 使用的 flow 字符串 */
export function epubFlowForLayoutMode(mode: ReaderLayoutMode): "auto" | "scrolled-doc" {
  return mode === "paginated" ? "auto" : "scrolled-doc";
}
