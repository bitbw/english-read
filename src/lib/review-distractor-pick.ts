/**
 * 复习测验干扰项挑选（无 React / 无 clientFetch，可供 Route Handler 使用）
 */

export type DistractorPickWord = { word: string };

export function looksLikeChinese(s: string): boolean {
  return /[\u3000-\u303f\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/.test(s);
}

export function glossDedupKey(zh: string): string {
  return zh.trim().toLowerCase().replace(/\s+/g, "");
}

export function normalizeWordKey(w: string): string {
  return w.toLowerCase().replace(/[^a-z]/g, "");
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const row = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) row[j] = j;
  for (let i = 1; i <= m; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = row[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + cost);
      prev = tmp;
    }
  }
  return row[n];
}

/** 与 pickSimilarWords 一致：编辑距离 + 轻微长度惩罚 */
function formSimilarityScore(targetKey: string, candidateKey: string): number {
  if (!candidateKey || candidateKey === targetKey) return Number.POSITIVE_INFINITY;
  const dist = levenshtein(targetKey, candidateKey);
  const bonus = Math.abs(targetKey.length - candidateKey.length) * 0.15;
  return dist + bonus;
}

/**
 * 从词库近形词 + Datamuse 近拼写词合并后，按拼写接近度取若干干扰英文词。
 */
export function pickDistractorEnglishWords(
  targetWord: string,
  datamuseList: string[],
  vocabSimilar: DistractorPickWord[],
  need: number
): string[] {
  const tk = normalizeWordKey(targetWord);
  if (!tk) return [];

  const seen = new Set<string>();
  const candidates: string[] = [];

  const pushUnique = (raw: string) => {
    const w = raw.trim();
    const k = normalizeWordKey(w);
    if (!k || k === tk || seen.has(k)) return;
    seen.add(k);
    candidates.push(w);
  };

  for (const v of vocabSimilar) {
    pushUnique(v.word);
  }
  for (const w of datamuseList) {
    pushUnique(w);
  }

  const scored = candidates
    .map((w) => {
      const ck = normalizeWordKey(w);
      return { w, score: formSimilarityScore(tk, ck) };
    })
    .filter((x) => Number.isFinite(x.score))
    .sort((a, b) => a.score - b.score || a.w.localeCompare(b.w));

  return scored.slice(0, need).map((x) => x.w);
}
