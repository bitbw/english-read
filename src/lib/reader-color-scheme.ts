/**
 * 阅读器颜色方案定义。
 * 每种方案包含暗色/亮色各一组背景色和文字色。
 * 默认方案为 "a"（深灰+柔白，类 Kindle）。
 */

export type ReaderColorSchemeId = "a" | "b" | "c";

export interface ReaderColorPair {
  bg: string;
  fg: string;
}

export interface ReaderColorScheme {
  dark: ReaderColorPair;
  light: ReaderColorPair;
}

export const READER_COLOR_SCHEME_STORAGE_KEY = "english-read-reader-color-scheme";
export const DEFAULT_COLOR_SCHEME: ReaderColorSchemeId = "a";

export const READER_COLOR_SCHEMES: Record<ReaderColorSchemeId, ReaderColorScheme> = {
  a: {
    // 极简（默认：深灰+柔白，类 Kindle）
    dark: { bg: "oklch(0.18 0 0)", fg: "oklch(0.85 0 0)" },
    light: { bg: "oklch(1 0 0)", fg: "oklch(0.145 0 0)" },
  },
  b: {
    // 暖色护眼（暖灰+暖白，类纸质书）
    dark: { bg: "oklch(0.18 0.008 50)", fg: "oklch(0.85 0.005 50)" },
    light: { bg: "oklch(0.98 0.005 50)", fg: "oklch(0.18 0 0)" },
  },
  c: {
    // 冷色沉稳（深蓝灰+柔白，科技感）
    dark: { bg: "oklch(0.21 0.01 250)", fg: "oklch(0.85 0.01 250)" },
    light: { bg: "oklch(0.99 0.003 250)", fg: "oklch(0.145 0 0)" },
  },
};

const SCHEME_LABELS: Record<
  ReaderColorSchemeId,
  { zh: string; en: string; descriptionZh: string; descriptionEn: string }
> = {
  a: {
    zh: "极简",
    en: "Minimal",
    descriptionZh: "深灰背景 + 柔白文字，类 Kindle 阅读体验",
    descriptionEn: "Dark gray background + soft white text, Kindle-like",
  },
  b: {
    zh: "暖色护眼",
    en: "Warm",
    descriptionZh: "暖灰背景 + 暖白文字，类纸质书体验",
    descriptionEn: "Warm gray background + warm white text, paper-like",
  },
  c: {
    zh: "冷色沉稳",
    en: "Cool",
    descriptionZh: "深蓝灰背景 + 柔白文字，科技感沉稳风格",
    descriptionEn: "Deep blue-gray background + soft white text, sleek style",
  },
};

export function getColorSchemeLabel(id: ReaderColorSchemeId, locale: "zh" | "en"): string {
  return SCHEME_LABELS[id][locale === "zh" ? "zh" : "en"];
}

export function getColorSchemeDescription(
  id: ReaderColorSchemeId,
  locale: "zh" | "en"
): string {
  return SCHEME_LABELS[id][locale === "zh" ? "descriptionZh" : "descriptionEn"];
}

export function readColorSchemeFromStorage(): ReaderColorSchemeId {
  if (typeof window === "undefined") return DEFAULT_COLOR_SCHEME;
  try {
    const raw = localStorage.getItem(READER_COLOR_SCHEME_STORAGE_KEY);
    if (raw === "a" || raw === "b" || raw === "c") return raw;
  } catch {
    /* ignore */
  }
  return DEFAULT_COLOR_SCHEME;
}

export function writeColorSchemeToStorage(id: ReaderColorSchemeId): void {
  try {
    localStorage.setItem(READER_COLOR_SCHEME_STORAGE_KEY, id);
  } catch {
    /* ignore */
  }
}

export function getReaderColorPair(
  schemeId: ReaderColorSchemeId,
  isDark: boolean
): ReaderColorPair {
  const scheme = READER_COLOR_SCHEMES[schemeId];
  return isDark ? scheme.dark : scheme.light;
}
