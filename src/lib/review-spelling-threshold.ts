export const REVIEW_SPELLING_THRESHOLD_KEY = "english-read-review-spelling-chunk-threshold";

export const DEFAULT_REVIEW_SPELLING_THRESHOLD = 3;

export function readThresholdFromStorage(): number {
  if (typeof window === "undefined") return DEFAULT_REVIEW_SPELLING_THRESHOLD;
  try {
    const raw = localStorage.getItem(REVIEW_SPELLING_THRESHOLD_KEY);
    if (raw !== null) {
      const n = parseInt(raw, 10);
      if (n >= 2 && n <= 6) return n;
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_REVIEW_SPELLING_THRESHOLD;
}

export function writeThresholdToStorage(threshold: number): void {
  try {
    localStorage.setItem(REVIEW_SPELLING_THRESHOLD_KEY, String(threshold));
  } catch {
    /* ignore */
  }
}