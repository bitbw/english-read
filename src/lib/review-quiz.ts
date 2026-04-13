"use client";

import { clientFetch } from "@/lib/client-fetch";

/**
 * 复习测验：中文四选一（动态干扰项 + 多义项）+ 拼字块干扰
 */

/** def=英文释义；中文仅出现在 pos「译」条，且与 zh 同文 */
export type DefEntry = { pos: string; def: string; zh?: string };

export type QuizWord = {
  id: string;
  word: string;
  definition: string | null;
};

const GENERIC_MEANING_DECOYS = [
  "那里；那儿",
  "这里；这儿",
  "他们的；她们的；它们的",
  "…的（所有格、关系代词）",
  "何时；什么时候",
  "是否；是不是",
  "虽然；尽管",
  "因为；由于",
];

export function parseDefinitions(definition: string | null): DefEntry[] {
  if (!definition) return [];
  try {
    const arr = JSON.parse(definition) as DefEntry[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

/** 生词本里已保存的中文：仅 pos「译」的 zh（无则退回 def） */
export function storedChineseGloss(definition: string | null): string | null {
  const yi = parseDefinitions(definition).find((d) => d.pos === "译");
  const s = yi?.zh?.trim() || yi?.def?.trim();
  return s || null;
}

/** 是否像中文（含 CJK），用于复习选项避免再出现整段英文释义 */
export function looksLikeChinese(s: string): boolean {
  return /[\u3000-\u303f\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/.test(s);
}

/**
 * 复习用：优先已存中文，否则查词典接口取整词/短语翻译（客户端调用）
 */
export async function resolveChineseGloss(
  word: string,
  definition: string | null,
  cache: Map<string, string>
): Promise<string> {
  const key = word.trim().toLowerCase();
  if (cache.has(key)) return cache.get(key)!;

  const stored = storedChineseGloss(definition);
  if (stored && looksLikeChinese(stored)) {
    cache.set(key, stored);
    return stored;
  }

  try {
    const res = await clientFetch(`/api/dictionary?word=${encodeURIComponent(word.trim())}`, {
      showErrorToast: false,
    });
    if (!res.ok) throw new Error("dict");
    const data = (await res.json()) as { translation?: string };
    const t = (data.translation ?? "").trim();
    if (t && !t.startsWith("PLEASE") && !t.includes("MYMEMORY")) {
      cache.set(key, t);
      return t;
    }
  } catch {
    /* 忽略 */
  }

  cache.set(key, "");
  return "";
}

/** 取首要义：有「译」条用其 zh/def，否则用首条英文 def */
export function primaryGloss(definition: string | null): string | null {
  const defs = parseDefinitions(definition);
  if (defs.length === 0) return null;
  const yi = defs.find((d) => d.pos === "译");
  const fromYi = yi?.zh?.trim() || yi?.def?.trim();
  if (fromYi) return fromYi;
  return defs[0].def?.trim() || null;
}

function levenshtein(a: string, b: string): number {
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

export function normalizeWordKey(w: string): string {
  return w.toLowerCase().replace(/[^a-z]/g, "");
}

/** 从候选里选拼写最接近的若干词（用于拼字干扰） */
export function pickSimilarWords(
  target: string,
  candidates: QuizWord[],
  excludeId: string,
  take: number
): QuizWord[] {
  const key = normalizeWordKey(target);
  if (!key) return [];

  const scored = candidates
    .filter((c) => c.id !== excludeId)
    .map((c) => {
      const ck = normalizeWordKey(c.word);
      if (!ck || ck === key) return null;
      const dist = levenshtein(key, ck);
      const bonus = Math.abs(key.length - ck.length) * 0.15;
      return { c, score: dist + bonus };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => a.score - b.score);

  const out: QuizWord[] = [];
  const seen = new Set<string>();
  for (const { c } of scored) {
    const k = normalizeWordKey(c.word);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(c);
    if (out.length >= take) break;
  }
  return out;
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 按空白拆成片段（保留各词原有大小写，用于展示与点选） */
export function splitPhraseTokens(s: string): string[] {
  return s
    .trim()
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

/** 复习拼写：是否按「多个单词」出题（含两个及以上 token） */
export function isPhraseSpellingTarget(targetWord: string): boolean {
  return splitPhraseTokens(targetWord).length >= 2;
}

/** 单词：按长度拆成两段（归一化小写），如 sudden→sud+den、frosts→fro+sts */
function defaultWordChunks(word: string): string[] {
  const w = normalizeWordKey(word);
  if (!w) return [];
  if (w.length <= 2) return [w];
  if (w.length === 3) return [w.slice(0, 2), w.slice(2)];
  const mid = Math.floor(w.length / 2);
  return [w.slice(0, mid), w.slice(mid)];
}

/** 词内所有连续 2、3 字母子串（去重，归一化小写） */
function uniqueLen23Substrings(key: string): string[] {
  const set = new Set<string>();
  for (const len of [2, 3] as const) {
    for (let i = 0; i + len <= key.length; i++) {
      set.add(key.slice(i, i + len));
    }
  }
  return Array.from(set);
}

/** 单个单词：每位字母各一块 + 词内 2～3 字母子串 + 对半大块 + 干扰 */
function buildSingleWordSpellingChunks(targetWord: string, similarEnglish: string[]): string[] {
  const key = normalizeWordKey(targetWord);
  if (!key) return [];

  const letterChunks = key.split("");
  const multiSet = new Set<string>(uniqueLen23Substrings(key));
  for (const part of defaultWordChunks(targetWord)) {
    if (part.length >= 2) multiSet.add(part);
  }
  const multiChunks = Array.from(multiSet);

  const correctSide = [...letterChunks, ...multiChunks];
  const correctLabelSet = new Set(correctSide);

  const simKeys = similarEnglish.map(normalizeWordKey).filter(Boolean);
  const decoysRaw = collectDecoyChunksFromWords(simKeys);
  const singles = key.length >= 4 ? extraLetterDecoys(key, [key, ...simKeys], 6) : [];

  const decoyMerged = [...shuffle(decoysRaw).slice(0, 10), ...shuffle(singles)];
  const decoySeen = new Set<string>();
  const decoyOut: string[] = [];
  for (const p of decoyMerged) {
    if (!p) continue;
    if (correctLabelSet.has(p)) continue;
    if (decoySeen.has(p)) continue;
    decoySeen.add(p);
    decoyOut.push(p);
  }

  return shuffle([...correctSide, ...decoyOut]);
}

/** 短语拼写干扰：近形词/词组拆词 + 少量功能词 */
const PHRASE_FALLBACK_DECOY_WORDS = [
  "the",
  "a",
  "an",
  "to",
  "of",
  "and",
  "in",
  "on",
  "at",
  "for",
  "is",
  "it",
  "as",
  "be",
  "we",
  "you",
  "he",
  "she",
  "they",
  "this",
  "that",
  "with",
  "from",
  "by",
];

function buildPhraseSpellingChunks(targetWord: string, similarEnglish: string[]): string[] {
  const correct = splitPhraseTokens(targetWord);
  const correctNorm = new Set(correct.map((t) => normalizeWordKey(t)));

  const decoyPool: string[] = [];
  const seenDecoyNorm = new Set<string>();

  const tryAddDecoy = (raw: string) => {
    const t = raw.trim();
    if (!t) return;
    const nk = normalizeWordKey(t);
    if (!nk || correctNorm.has(nk) || seenDecoyNorm.has(nk)) return;
    seenDecoyNorm.add(nk);
    decoyPool.push(t);
  };

  for (const line of similarEnglish) {
    for (const tok of splitPhraseTokens(line)) {
      tryAddDecoy(tok);
    }
  }

  for (const w of PHRASE_FALLBACK_DECOY_WORDS) {
    if (decoyPool.length >= 12) break;
    tryAddDecoy(w);
  }

  const wantExtra = Math.max(3, correct.length + 2);
  const decoys = shuffle(decoyPool).slice(0, Math.min(decoyPool.length, wantExtra));

  return shuffle([...correct, ...decoys]);
}

function collectDecoyChunksFromWords(similarKeys: string[]): string[] {
  const decoys: string[] = [];
  for (const raw of similarKeys) {
    const w = normalizeWordKey(raw);
    if (w.length < 2) continue;
    for (const len of [2, 3] as const) {
      for (let i = 0; i + len <= w.length; i++) {
        decoys.push(w.slice(i, i + len));
      }
    }
  }
  return decoys;
}

function extraLetterDecoys(targetKey: string, similarKeys: string[], maxSingles: number): string[] {
  const singles: string[] = [];
  const seen = new Set<string>();
  for (const s of similarKeys) {
    for (const ch of normalizeWordKey(s)) {
      if (!/[a-z]/.test(ch)) continue;
      if (seen.has(ch)) continue;
      seen.add(ch);
      singles.push(ch);
      if (singles.length >= maxSingles) return singles;
    }
  }
  const noise = "qxjzvwfk";
  for (const ch of noise) {
    if (!targetKey.includes(ch) && !seen.has(ch)) {
      seen.add(ch);
      singles.push(ch);
      if (singles.length >= maxSingles) break;
    }
  }
  return singles;
}

/**
 * 拼字块：单词 = 逐字母（重复字母多块）+ 词内 2～3 字母子串 + 对半大块 + 干扰；
 * 词组 = 按空格分词 + 干扰词（见 buildPhraseSpellingChunks）。
 */
export function buildSpellingChunks(targetWord: string, similarEnglish: string[]): string[] {
  if (isPhraseSpellingTarget(targetWord)) {
    return buildPhraseSpellingChunks(targetWord, similarEnglish);
  }
  return buildSingleWordSpellingChunks(targetWord, similarEnglish);
}

/** 翻面后展示：对应英文词 */
export type MeaningOption = {
  key: string;
  /** 干扰项可能无对应英文词（极少数兜底） */
  english: string | null;
  primaryZh: string;
  correct: boolean;
};

export type MeaningQuiz = {
  options: MeaningOption[];
  skipMeaning: boolean;
};

function glossDedupKey(zh: string): string {
  return zh.trim().toLowerCase().replace(/\s+/g, "");
}

/** 与 pickSimilarWords 一致：编辑距离 + 轻微长度惩罚，用于在「词库 + Datamuse」合并池里统一排序 */
function formSimilarityScore(targetKey: string, candidateKey: string): number {
  if (!candidateKey || candidateKey === targetKey) return Number.POSITIVE_INFINITY;
  const dist = levenshtein(targetKey, candidateKey);
  const bonus = Math.abs(targetKey.length - candidateKey.length) * 0.15;
  return dist + bonus;
}

/**
 * 从词库近形词 + Datamuse 近拼写词合并后，按拼写接近度取若干干扰英文词。
 * 若先词库后 API，词库里「相对最近」但仍很远的词会占满名额，导致 API 近形词永远进不来。
 */
export function pickDistractorEnglishWords(
  targetWord: string,
  datamuseList: string[],
  vocabSimilar: QuizWord[],
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

/**
 * 组装四选一：中文选项 + 翻面仅展示对应英文词
 */
export async function buildMeaningQuizEnriched(args: {
  currentId: string;
  currentWord: string;
  currentDefinition: string | null;
  distractorEnglish: string[];
  glossCache: Map<string, string>;
}): Promise<MeaningQuiz> {
  const { currentId, currentWord, currentDefinition, distractorEnglish, glossCache } = args;

  const correctZh = (
    await resolveChineseGloss(currentWord, currentDefinition, glossCache)
  ).trim();
  if (!correctZh || !looksLikeChinese(correctZh)) {
    return { options: [], skipMeaning: true };
  }

  type Row = {
    key: string;
    english: string | null;
    primaryZh: string;
    correct: boolean;
  };

  const rows: Row[] = [
    {
      key: currentId,
      english: currentWord.trim(),
      primaryZh: correctZh,
      correct: true,
    },
  ];

  const usedZh = new Set<string>([glossDedupKey(correctZh)]);
  let genericIdx = 0;

  const distractorMeta = await Promise.all(
    distractorEnglish.map(async (en) => {
      const zh = (await resolveChineseGloss(en, null, glossCache)).trim();
      return { en, zh };
    })
  );

  for (const { en, zh } of distractorMeta) {
    if (rows.length >= 4) break;
    if (zh && looksLikeChinese(zh) && !usedZh.has(glossDedupKey(zh))) {
      usedZh.add(glossDedupKey(zh));
      rows.push({
        key: `d-${normalizeWordKey(en)}-${rows.length}`,
        english: en.trim(),
        primaryZh: zh,
        correct: false,
      });
    }
  }

  while (rows.length < 4) {
    const g = GENERIC_MEANING_DECOYS[genericIdx++] ?? `（干扰 ${rows.length}）`;
    if (!usedZh.has(glossDedupKey(g))) {
      usedZh.add(glossDedupKey(g));
      rows.push({
        key: `gen-${rows.length}`,
        english: null,
        primaryZh: g,
        correct: false,
      });
    }
    if (genericIdx > GENERIC_MEANING_DECOYS.length + 5) break;
  }

  const options: MeaningOption[] = shuffle(rows).map((r) => ({
    key: r.key,
    english: r.english,
    primaryZh: r.primaryZh,
    correct: r.correct,
  }));

  return { options, skipMeaning: false };
}

export function assembledMatchesTarget(built: string, targetWord: string): boolean {
  const b = normalizeWordKey(built);
  const t = normalizeWordKey(targetWord);
  return b.length > 0 && b === t;
}
