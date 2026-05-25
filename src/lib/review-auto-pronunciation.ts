export const REVIEW_AUTO_PRONUNCIATION_STORAGE_KEY =
  "english-read-review-auto-play-pronunciation";

export const DEFAULT_REVIEW_AUTO_PRONUNCIATION = true;

export function readReviewAutoPronunciationFromStorage(): boolean {
  if (typeof window === "undefined") return DEFAULT_REVIEW_AUTO_PRONUNCIATION;
  try {
    const raw = localStorage.getItem(REVIEW_AUTO_PRONUNCIATION_STORAGE_KEY);
    if (raw === "0") return false;
    if (raw === "1") return true;
  } catch {
    /* ignore */
  }
  return DEFAULT_REVIEW_AUTO_PRONUNCIATION;
}

export function writeReviewAutoPronunciationToStorage(enabled: boolean): void {
  try {
    localStorage.setItem(REVIEW_AUTO_PRONUNCIATION_STORAGE_KEY, enabled ? "1" : "0");
  } catch {
    /* ignore */
  }
}
