"use client";

import { clientFetch } from "@/lib/client-fetch";
import {
  glossDedupKey,
  levenshtein,
  looksLikeChinese,
  normalizeWordKey,
} from "@/lib/review-distractor-pick";

export { looksLikeChinese, normalizeWordKey, pickDistractorEnglishWords } from "@/lib/review-distractor-pick";

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
    const res = await clientFetch(
      `/api/dictionary?word=${encodeURIComponent(word.trim())}&youdaoOnly=1`,
      {
        showErrorToast: false,
      }
    );
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

export type SpellingTrayLayout = "word" | "phrase";

export type SpellingTraySpec = {
  labels: string[];
  layout: SpellingTrayLayout;
  /** 单词：前 `chunkCount` 个为字块区（含干扰），其后为字母区；词组为 0 */
  chunkCount: number;
};

/** 单词拆成若干连续大块（覆盖全词） */
function chunkPartCount(wordLen: number): number {
  if (wordLen <= 4) return 1;
  if (wordLen <= 8) return 2;
  return Math.min(5, Math.max(3, Math.ceil(wordLen / 4)));
}

function balancedPartition(key: string, parts: number): string[] {
  const n = key.length;
  if (n === 0) return [];
  const k = Math.min(Math.max(1, parts), n);
  const base = Math.floor(n / k);
  let rem = n % k;
  const out: string[] = [];
  let i = 0;
  for (let p = 0; p < k; p++) {
    const sz = base + (rem > 0 ? 1 : 0);
    if (rem > 0) rem--;
    out.push(key.slice(i, i + sz));
    i += sz;
  }
  return out;
}

const FALLBACK_CHUNK_DECOYS = ["qx", "zw", "jk", "fv", "mp", "bg", "td", "hw"];

function collectChunkishDecoysFromWords(similarKeys: string[]): string[] {
  const decoys: string[] = [];
  for (const raw of similarKeys) {
    const w = normalizeWordKey(raw);
    if (w.length < 2) continue;
    for (const len of [2, 3, 4] as const) {
      for (let i = 0; i + len <= w.length; i++) {
        decoys.push(w.slice(i, i + len));
      }
    }
  }
  return decoys;
}

function pickTwoDecoyChunks(correctChunks: string[], simKeys: string[]): string[] {
  const forbid = new Set(correctChunks);
  const pool = shuffle(
    collectChunkishDecoysFromWords(simKeys).filter((c) => c.length >= 2 && !forbid.has(c))
  );
  const out: string[] = [];
  const seen = new Set<string>();
  for (const c of pool) {
    if (out.length >= 2) break;
    if (seen.has(c)) continue;
    seen.add(c);
    out.push(c);
  }
  for (const fb of FALLBACK_CHUNK_DECOYS) {
    if (out.length >= 2) break;
    if (!forbid.has(fb) && !seen.has(fb)) {
      seen.add(fb);
      out.push(fb);
    }
  }
  return out.slice(0, 2);
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

function pickTwoLetterDecoys(targetKey: string, simKeys: string[]): string[] {
  const inWord = new Set(targetKey.split(""));
  const pool = shuffle(
    extraLetterDecoys(targetKey, [targetKey, ...simKeys], 24).filter((ch) => !inWord.has(ch))
  );
  const out = pool.slice(0, 2);
  const noise = "qxjzvwfk";
  let i = 0;
  while (out.length < 2 && i < noise.length) {
    const ch = noise[i++]!;
    if (!inWord.has(ch) && !out.includes(ch)) out.push(ch);
  }
  return out.slice(0, 2);
}

/**
 * 单词：字块区 = 整词划成数段 + 2 个干扰块；字母区 = 每个字母一块 + 2 个干扰字母。
 * `labels` 先字块区后字母区，由 `chunkCount` 分界。
 */
function buildSingleWordSpellingTray(targetWord: string, similarEnglish: string[]): SpellingTraySpec {
  const key = normalizeWordKey(targetWord);
  if (!key) return { labels: [], layout: "word", chunkCount: 0 };

  const simKeys = similarEnglish.map(normalizeWordKey).filter(Boolean);

  const parts = chunkPartCount(key.length);
  const chunks = balancedPartition(key, parts);
  const chunkDecoys = pickTwoDecoyChunks(chunks, simKeys);
  const chunkLabels = shuffle([...chunks, ...chunkDecoys]);

  const letters = key.split("");
  const letterDecoys = pickTwoLetterDecoys(key, simKeys);
  const letterLabels = shuffle([...letters, ...letterDecoys]);

  const labels = [...chunkLabels, ...letterLabels];
  return { labels, layout: "word", chunkCount: chunkLabels.length };
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

function buildPhraseSpellingTray(targetWord: string, similarEnglish: string[]): SpellingTraySpec {
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
    tryAddDecoy(w);
  }

  const picked: string[] = [];
  const pickedNorm = new Set<string>();
  for (const d of shuffle(decoyPool)) {
    if (picked.length >= 2) break;
    const nk = normalizeWordKey(d);
    if (pickedNorm.has(nk)) continue;
    pickedNorm.add(nk);
    picked.push(d);
  }

  for (const w of PHRASE_FALLBACK_DECOY_WORDS) {
    if (picked.length >= 2) break;
    const nk = normalizeWordKey(w);
    if (correctNorm.has(nk) || pickedNorm.has(nk)) continue;
    pickedNorm.add(nk);
    picked.push(w);
  }

  const extras = ["the", "and", "for", "with", "you", "that", "from", "this", "have", "were"];
  for (const w of extras) {
    if (picked.length >= 2) break;
    const nk = normalizeWordKey(w);
    if (correctNorm.has(nk) || pickedNorm.has(nk)) continue;
    pickedNorm.add(nk);
    picked.push(w);
  }
  const padWords = ["xx", "yy", "qq", "zz"];
  for (const w of padWords) {
    if (picked.length >= 2) break;
    const nk = normalizeWordKey(w);
    if (correctNorm.has(nk) || pickedNorm.has(nk)) continue;
    pickedNorm.add(nk);
    picked.push(w);
  }

  return { labels: shuffle([...correct, ...picked.slice(0, 2)]), layout: "phrase", chunkCount: 0 };
}

/**
 * 拼字托盘：单词 = 字块区（上）+ 字母区（下）合并为同一序列；词组 = 按空格分词 + 2 干扰词。
 */
export function buildSpellingTray(targetWord: string, similarEnglish: string[]): SpellingTraySpec {
  if (isPhraseSpellingTarget(targetWord)) {
    return buildPhraseSpellingTray(targetWord, similarEnglish);
  }
  return buildSingleWordSpellingTray(targetWord, similarEnglish);
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

/**
 * 组装四选一：中文选项 + 翻面仅展示对应英文词
 */
export async function buildMeaningQuizEnriched(args: {
  currentId: string;
  currentWord: string;
  currentDefinition: string | null;
  distractorEnglish: string[];
  /** 已由服务端用有道拉好的干扰项（如 /api/review/similar-words），减少客户端多次查词 */
  distractorPreload?: ReadonlyArray<{ word: string; zh: string }>;
  glossCache: Map<string, string>;
}): Promise<MeaningQuiz> {
  const { currentId, currentWord, currentDefinition, distractorEnglish, distractorPreload, glossCache } =
    args;

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

  if (distractorPreload?.length) {
    for (const { word, zh } of distractorPreload) {
      if (rows.length >= 4) break;
      const en = word.trim();
      const tzh = zh.trim();
      if (!en || !tzh || !looksLikeChinese(tzh) || usedZh.has(glossDedupKey(tzh))) continue;
      usedZh.add(glossDedupKey(tzh));
      const k = en.toLowerCase();
      if (!glossCache.has(k)) glossCache.set(k, tzh);
      rows.push({
        key: `d-${normalizeWordKey(en)}-${rows.length}`,
        english: en,
        primaryZh: tzh,
        correct: false,
      });
    }
  }

  /** 预载已凑满四选一时，不再为词库补位词请求 dictionary */
  if (rows.length < 4) {
    const usedEnKey = new Set(
      rows.flatMap((r) => (r.english ? [normalizeWordKey(r.english)] : []))
    );
    const toResolve = distractorEnglish.filter((en) => !usedEnKey.has(normalizeWordKey(en)));

    const distractorMeta = await Promise.all(
      toResolve.map(async (en) => {
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
