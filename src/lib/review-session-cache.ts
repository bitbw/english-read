import { isValidPlanDayKey } from "@/lib/review-plan";

const STORAGE_PREFIX = "english-read:reviewCleared:v1:";

/** 用户本地日历日 YYYY-MM-DD（用于「今日复习」无 date 参数时） */
function localCalendarDayKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * 与复习页 scope 对齐：有合法 `date` 查询则用该日；否则用本地「今天」。
 * 用于 localStorage 键，使「指定日复习」与计划日历一致。
 */
export function getReviewScopeDay(dateParam: string | null): string {
  if (dateParam && isValidPlanDayKey(dateParam)) return dateParam;
  return localCalendarDayKey();
}

function readIds(scopeDay: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + scopeDay);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.filter((x): x is string => typeof x === "string"));
  } catch {
    return new Set();
  }
}

function writeIds(scopeDay: string, ids: Set<string>): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_PREFIX + scopeDay, JSON.stringify(Array.from(ids)));
}

export function getClearedReviewIds(scopeDay: string): Set<string> {
  return readIds(scopeDay);
}

/** 释义+拼写已成功提交后调用：该词在当日 scope 内不再出现在待复习列表（直至服务端也已排期） */
export function markReviewClearedForScope(scopeDay: string, vocabularyId: string): void {
  const s = readIds(scopeDay);
  s.add(vocabularyId);
  writeIds(scopeDay, s);
}

export function filterOutClearedReviews<T extends { id: string }>(
  words: T[],
  scopeDay: string
): T[] {
  const cleared = readIds(scopeDay);
  if (cleared.size === 0) return words;
  return words.filter((w) => !cleared.has(w.id));
}
