import type { Book, Location, NavItem } from "epubjs";
import { VOCAB_CONTEXT_MAX_LENGTH } from "@/lib/vocabulary-limits";

/** 从所在段落中截取一句（或整段截断）作为划词收藏时的「上下文」展示文案。 */
export function excerptSentenceForVocabulary(
  paragraph: string,
  selected: string
): string {
  const flat = paragraph.replace(/\s+/g, " ").trim();
  const sel = selected.trim();
  if (!flat) return sel;
  if (!sel) return flat.slice(0, VOCAB_CONTEXT_MAX_LENGTH);

  const lowerSel = sel.toLowerCase();
  const sentences = flat
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const hit =
    sentences.find((s) => s.toLowerCase().includes(lowerSel)) ??
    sentences.find((s) => {
      const w = sel.split(/\s+/).find(Boolean);
      return w ? s.toLowerCase().includes(w.toLowerCase()) : false;
    });

  let out = (hit ?? sentences[0] ?? flat).trim();
  const firstTok = sel.split(/\s+/).find(Boolean)?.toLowerCase() ?? lowerSel;
  if (firstTok && !out.toLowerCase().includes(firstTok)) {
    out = sel;
  }
  if (out.length > VOCAB_CONTEXT_MAX_LENGTH) {
    out = `${out.slice(0, VOCAB_CONTEXT_MAX_LENGTH)}…`;
  }
  return out;
}

/** epub 运行时 `spine.length` 有值，类型定义未写出 */
export function spineLength(book: Book): number {
  return (book.spine as Book["spine"] & { length: number }).length;
}

/** 全书进度 0–100：按 spine 索引估算（快，但章长度不均时偏差大） */
export function wholeBookPctFromSpine(book: Book, location: Location): number {
  const n = spineLength(book);
  const { index } = location.start;
  const { page, total } = location.start.displayed;
  const p = (index + page / total) / n;
  return Math.min(100, Math.max(0, p * 100));
}

/**
 * 全书进度 0–100：按 epubjs `locations` 索引（须先 `generate`）。
 * 无法匹配时返回 `null`，调用方不应回退到 spine（spine 在章长度不均时偏差大）。
 */
export function wholeBookPctFromLocations(
  book: Book,
  location: Location
): number | null {
  const cfi = location.start.cfi;
  const locs = book.locations as Book["locations"] & { total: number };
  /** epubjs 类型误标为 `Location`，运行时为 `number` 索引 */
  const locationIndex = locs.locationFromCfi(cfi) as unknown as number;

  if (locationIndex < 0) return null;

  const total = locs.total;
  if (total <= 0) return null;

  return Math.min(100, Math.max(0, (locationIndex / total) * 100));
}

/** 粗略估计总字符数（用于选择 `locations.generate` 的 char 间隔） */
export function estimateTotalChars(book: Book): number {
  return spineLength(book) * 10000;
}

/** 按估计篇幅选择 `generate(chars)` 的间隔，大书略疏、小书略密 */
export function getLocationsCharInterval(totalChars: number): number {
  if (totalChars > 1_000_000) {
    return 6400;
  }
  if (totalChars > 500_000) {
    return 3200;
  }
  if (totalChars > 100_000) {
    return 1600;
  }
  return 800;
}

/** 当前 spine 片段内分页进度 0–100（见 `DisplayedLocation.displayed`） */
export function chapterPctFromDisplayed(
  d: Location["start"]["displayed"]
): number {
  if (d.total === 1) return 100;
  return ((d.page - 1) / (d.total - 1)) * 100;
}

/** 在嵌套 `navToc` 中按当前节 `href`（去 #）后缀匹配目录项 */
function chapterLabelFromNavToc(
  items: NavItem[],
  href: string
): string | undefined {
  const path = href.split("#")[0] ?? "";
  if (!path) return undefined;
  for (const item of items) {
    const itemPath = (item.href ?? "").split("#")[0];
    if (itemPath && path.endsWith(itemPath)) {
      return item.label;
    }
    if (item.subitems?.length) {
      const nested = chapterLabelFromNavToc(item.subitems, href);
      if (nested) return nested;
    }
  }
  return undefined;
}

/** 当前位置的目录标题；目录无匹配时用 defaultFn（N 为 spine 索引 + 1）。 */
export function chapterDisplayName(
  location: Location,
  navToc: NavItem[],
  defaultFn: (n: number) => string
): string {
  const label = chapterLabelFromNavToc(navToc, location.start.href);
  return label?.trim() || defaultFn(location.start.index + 1);
}
