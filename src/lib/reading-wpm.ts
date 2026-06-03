/** 总秒数 ≥ minSeconds 时计算 WPM，否则返回 null */
export function avgWpmFromTotals(totalWords: number, totalSeconds: number, minSeconds = 300): number | null {
  if (totalSeconds < minSeconds) return null;
  return Math.round((totalWords / totalSeconds) * 60);
}

/** 单日 WPM；seconds 不足 minSeconds 时返回 null */
export function dayWpmFromPoint(
  words: number,
  seconds: number,
  minSeconds = 45
): number | null {
  if (seconds < minSeconds) return null;
  return Math.round((words / seconds) * 60);
}
