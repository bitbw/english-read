/** 英语阅读速度档位（估算 WPM，与 UI 文案 `readingSpeedTier.*` 对应） */
export type ReadingSpeedTierId =
  | "leisurely"
  | "developing"
  | "steady"
  | "fluent"
  | "rapid";

/**
 * WPM → 档位。阈值按常见 ESL 阅读语速区间简化划分（非国际标准考试分级）。
 */
export function readingSpeedTierFromWpm(wpm: number): ReadingSpeedTierId {
  const n = Number.isFinite(wpm) ? wpm : 0;
  if (n < 120) return "leisurely";
  if (n < 180) return "developing";
  if (n < 250) return "steady";
  if (n < 350) return "fluent";
  return "rapid";
}
