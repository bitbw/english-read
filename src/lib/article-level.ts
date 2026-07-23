export const ARTICLE_LEVEL_KEY = "article_level";

export function getSavedArticleLevel(): number {
  if (typeof document === "undefined") return 1;
  const match = document.cookie.match(
    new RegExp(`(?:^|;\\s*)${ARTICLE_LEVEL_KEY}=(\\d)`)
  );
  if (match) {
    const n = Number(match[1]);
    if (n >= 1 && n <= 3) return n;
  }
  return 1;
}

export function saveArticleLevel(level: number): void {
  if (typeof document === "undefined") return;
  document.cookie = `${ARTICLE_LEVEL_KEY}=${level}; path=/; max-age=31536000; SameSite=Lax`;
}

export function parseArticleLevel(value: string | undefined): number {
  if (!value) return 1;
  const n = Number(value);
  if (n >= 1 && n <= 3) return n;
  return 1;
}