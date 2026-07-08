export const ARTICLE_LEVEL_KEY = "english-read-article-level";

export function getSavedArticleLevel(): number {
  if (typeof window === "undefined") return 1;
  try {
    const v = localStorage.getItem(ARTICLE_LEVEL_KEY);
    if (v) {
      const n = Number(v);
      if (n >= 1 && n <= 3) return n;
    }
  } catch {}
  return 1;
}

export function saveArticleLevel(level: number): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(ARTICLE_LEVEL_KEY, String(level));
  } catch {}
}