/**
 * 复习测验：近形词中文四选一 + 拼字块干扰（仿英语帮式）
 */

/** def=英文释义；zh=中文（加入生词本时从词典接口写入，复习四选一优先用 zh） */
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

/** 生词本里已保存的中文（仅 JSON 的 zh 字段） */
export function storedChineseGloss(definition: string | null): string | null {
  const defs = parseDefinitions(definition);
  const zh = defs[0]?.zh?.trim();
  return zh || null;
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
    const res = await fetch(`/api/dictionary?word=${encodeURIComponent(word.trim())}`);
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

/** 取首要义（列表展示等：优先 zh，否则英文 def） */
export function primaryGloss(definition: string | null): string | null {
  const defs = parseDefinitions(definition);
  const first = defs[0];
  if (!first) return null;
  const zh = typeof first.zh === "string" ? first.zh.trim() : "";
  if (zh) return zh;
  const en = first.def?.trim();
  return en || null;
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

function normalizeWordKey(w: string): string {
  return w.toLowerCase().replace(/[^a-z]/g, "");
}

/** 从候选里选拼写最接近的若干词（用于近形干扰） */
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

function defaultWordChunks(word: string): string[] {
  const w = normalizeWordKey(word);
  if (!w) return [];
  if (w.length <= 2) return [w];
  if (w.length === 3) return [w.slice(0, 2), w.slice(2)];
  const mid = Math.floor(w.length / 2);
  return [w.slice(0, mid), w.slice(mid)];
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

/** 拼字块：含正确拆分 + 近形/字母干扰，洗牌后展示 */
export function buildSpellingChunks(targetWord: string, similarEnglish: string[]): string[] {
  const key = normalizeWordKey(targetWord);
  const correct = defaultWordChunks(targetWord);
  const simKeys = similarEnglish.map(normalizeWordKey).filter(Boolean);
  const decoys = collectDecoyChunksFromWords(simKeys).filter((d) => d && !correct.includes(d));

  const singles =
    key.length >= 4 ? extraLetterDecoys(key, [key, ...simKeys], 6) : [];

  const merged = [...correct, ...shuffle(decoys).slice(0, 8), ...shuffle(singles)];
  const uniq: string[] = [];
  const used = new Set<string>();
  for (const p of merged) {
    if (!p || used.has(p)) continue;
    used.add(p);
    uniq.push(p);
  }
  return shuffle(uniq);
}

export type MeaningQuiz = {
  options: { text: string; correct: boolean }[];
  skipMeaning: boolean;
};

/**
 * 四选一中文义：文案均为「整词中文翻译」（非英英长释义）。
 * glossById 由复习页对当前词 + 近形词调用 resolveChineseGloss 预先填好。
 */
export function buildMeaningQuizFromGlosses(
  currentId: string,
  glossById: Record<string, string>,
  similar: QuizWord[]
): MeaningQuiz {
  const correct = (glossById[currentId] ?? "").trim();
  if (!correct || !looksLikeChinese(correct)) {
    return { options: [], skipMeaning: true };
  }

  const distractorTexts: string[] = [];
  for (const w of similar) {
    if (w.id === currentId) continue;
    const g = (glossById[w.id] ?? "").trim();
    if (!g || !looksLikeChinese(g) || g === correct || distractorTexts.includes(g)) continue;
    distractorTexts.push(g);
    if (distractorTexts.length >= 3) break;
  }

  let gIdx = 0;
  while (distractorTexts.length < 3 && gIdx < GENERIC_MEANING_DECOYS.length) {
    const g = GENERIC_MEANING_DECOYS[gIdx++];
    if (g !== correct && !distractorTexts.includes(g)) distractorTexts.push(g);
  }

  let pad = 0;
  while (distractorTexts.length < 3) {
    pad += 1;
    distractorTexts.push(`（干扰项 ${pad}）`);
  }

  const options = shuffle([
    { text: correct, correct: true },
    ...distractorTexts.slice(0, 3).map((text) => ({ text, correct: false as const })),
  ]);

  return { options, skipMeaning: false };
}

export function assembledMatchesTarget(built: string, targetWord: string): boolean {
  const b = normalizeWordKey(built);
  const t = normalizeWordKey(targetWord);
  return b.length > 0 && b === t;
}
