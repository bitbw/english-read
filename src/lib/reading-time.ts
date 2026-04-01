/** UTC 日历日 YYYY-MM-DD，与阅读时长统计一致 */
export function utcDayString(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

/** 从「今天 UTC」往前共 numDays 天（含今天） */
export function utcDayKeys(numDays: number): string[] {
  const out: string[] = [];
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const date = now.getUTCDate();
  for (let i = numDays - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(y, m, date - i));
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}
