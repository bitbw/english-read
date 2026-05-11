/** epubjs `locations.generate(charStep)` 的 char 步长；与词数换算配套使用 */
export const READER_LOCATION_CHAR_STEP = 600;

/**
 * 由 locations 索引前进量估算英语词数（chars/5）。
 * 仅在 `book.locations.generate(charStep)` 完成后调用才与全书位置一致。
 */
export function wordsFromLocationIndexDelta(
  deltaLoc: number,
  charStep: number = READER_LOCATION_CHAR_STEP
): number {
  if (!(deltaLoc > 0) || !(charStep > 0)) return 0;
  return Math.round((deltaLoc * charStep) / 5);
}
