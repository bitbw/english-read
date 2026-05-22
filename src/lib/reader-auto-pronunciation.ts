export const READER_AUTO_PRONUNCIATION_STORAGE_KEY =
  "english-read-reader-auto-pronunciation";

export const DEFAULT_READER_AUTO_PRONUNCIATION = true;

export function readAutoPronunciationFromStorage(): boolean {
  if (typeof window === "undefined") return DEFAULT_READER_AUTO_PRONUNCIATION;
  try {
    const raw = localStorage.getItem(READER_AUTO_PRONUNCIATION_STORAGE_KEY);
    if (raw === "0") return false;
    if (raw === "1") return true;
  } catch {
    /* ignore */
  }
  return DEFAULT_READER_AUTO_PRONUNCIATION;
}

export function writeAutoPronunciationToStorage(enabled: boolean): void {
  try {
    localStorage.setItem(READER_AUTO_PRONUNCIATION_STORAGE_KEY, enabled ? "1" : "0");
  } catch {
    /* ignore */
  }
}
