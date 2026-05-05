import {
  glossDedupKey,
  looksLikeChinese,
  normalizeWordKey,
  pickDistractorEnglishWords,
} from "@/lib/review-distractor-pick";
import { fetchYoudaoExplain } from "@/lib/youdao-suggest";
import { unstable_cache } from "next/cache";
import { generateText, Output } from "ai";
import { z } from "zod";

/** 服务端按词条缓存干扰项；秒，与 Datamuse fetch 的 3600 量级对齐并控制有道调用频率 */
const SIMILAR_WORDS_CACHE_REVALIDATE_SEC = 86400;

const PHRASE_LLM_MODEL = "deepseek/deepseek-v4-flash" as const;

const phraseDistractorsSchema = z.object({
  distractors: z
    .array(
      z.object({
        word: z.string(),
        explainZh: z.string(),
      })
    )
    .length(3),
});

export function isMultiWordPhrase(word: string): boolean {
  return word.trim().split(/\s+/).filter(Boolean).length > 1;
}

function phraseDistractorPrompt(phrase: string): string {
  const quoted = JSON.stringify(phrase);
  return `You are helping build English vocabulary quiz wrong answers.

Target English phrase:
${quoted}

Hard rules for the three distractors:
1) None of the three "word" strings may be **exactly** the same phrase as the target (case-insensitive; trivial punctuation/spacing-only variants count as the same). Everything else is allowed: phrases may reuse individual words from the target — only avoid returning the **whole** phrase unchanged.
2) Each "explainZh" gloss must **not** be too close in meaning to the target phrase's correct sense; wrong answers should read clearly different in Chinese so the learner can tell them apart from the right gloss.

Return exactly 3 English phrases for wrong answers:
- plausible confusions (similar sound, spelling, or wording), natural collocations when possible,
- the three phrases distinct from **each other** (no duplicate distractors).

For each item, "explainZh" must be a concise Chinese dictionary-style gloss, like:
"n. …; …" or "adj. …" or "v. …; …" (use Chinese explanations; you may prefix part-of-speech abbreviations as in learner dictionaries).

Output must strictly follow the JSON schema (3 items in "distractors").`;
}

function lettersKey(w: string): string {
  return w.toLowerCase().replace(/[^a-z]/g, "");
}

function buildSpPatterns(base: string): string[] {
  const n = base.length;
  if (n === 0) return [];
  if (n <= 2) return [`${base}*`];
  if (n === 3) return [`${base.slice(0, 2)}*`];
  const patterns = [`${base.slice(0, 3)}*`, `*${base.slice(-3)}`];
  if (n >= 6) {
    patterns.push(`${base.slice(0, 2)}?${base.slice(-2)}`);
  }
  return patterns;
}

const DATAMUSE_MAX = 18;
const YOUDAO_PROBE = 14;

export type SimilarWordDistractor = { word: string; explainZh: string };

/** Trim + collapse internal whitespace; stable cache key input (preserves casing like the route did). */
export function canonicalSimilarWordsQuery(word: string): string {
  return word.trim().replace(/\s+/g, " ");
}

function logSimilarWordsCacheMiss(canonicalWord: string): void {
  const enabled =
    process.env.SIMILAR_WORDS_CACHE_LOG === "1" || process.env.NODE_ENV !== "production";
  if (!enabled) return;
  console.log("[similar-words] cache MISS (computing)", {
    canonicalWord,
    phrase: isMultiWordPhrase(canonicalWord),
  });
}

/**
 * 实际计算（不经 unstable_cache）。鉴权必须在 Route Handler，本模块只做按词条可共享的结果缓存。
 */
async function computeSimilarWordDistractors(
  canonicalWord: string
): Promise<{ distractors: SimilarWordDistractor[] }> {
  const word = canonicalWord;

  if (isMultiWordPhrase(word)) {
    if (!process.env.AI_GATEWAY_API_KEY?.trim()) {
      return { distractors: [] };
    }
    const result = await generateText({
      model: PHRASE_LLM_MODEL,
      output: Output.object({ schema: phraseDistractorsSchema }),
      prompt: phraseDistractorPrompt(word),
    });
    const logPhraseLlm =
      process.env.SIMILAR_WORDS_LLM_LOG === "1" || process.env.NODE_ENV === "development";
    if (logPhraseLlm) {
      const logMax = 16_000;
      const t = result.text;
      console.log("[similar-words] phrase LLM raw text", {
        canonicalWord: word,
        textLength: t.length,
        text: t.length > logMax ? `${t.slice(0, logMax)}\n...[truncated]` : t,
      });
    }
    const targetKey = normalizeWordKey(word);
    const filtered = result.output.distractors.filter(
      (d) => normalizeWordKey(d.word.trim()) !== targetKey
    );
    return { distractors: filtered };
  }

  const firstToken = word.trim().split(/\s+/)[0] ?? "";
  const base = lettersKey(firstToken);
  const targetFullKey = lettersKey(word);

  const norm = (w: string) => w.toLowerCase().replace(/[^a-z\s]/g, "").replace(/\s+/g, " ").trim();

  const maxLenDiff = base.length <= 2 ? 2 : 4;

  const acceptCandidate = (raw: string): string | null => {
    const w = raw.trim();
    if (!w || /[^a-zA-Z\s\-']/.test(w.replace(/\s/g, ""))) return null;
    const ck = lettersKey(w);
    if (!ck || ck === targetFullKey) return null;
    if (Math.abs(ck.length - base.length) > maxLenDiff) return null;
    return w;
  };

  if (!base) {
    return { distractors: [] };
  }

  const patterns = buildSpPatterns(base);
  const merged: string[] = [];

  try {
    const fetches = patterns.map((sp) =>
      fetch(`https://api.datamuse.com/words?sp=${encodeURIComponent(sp)}&max=${DATAMUSE_MAX}`, {
        next: { revalidate: 3600 },
      })
    );
    const responses = await Promise.all(fetches);
    for (const res of responses) {
      if (!res.ok) continue;
      const data = (await res.json()) as { word?: string }[];
      for (const it of data) {
        const ok = acceptCandidate(it.word ?? "");
        if (ok) merged.push(ok);
      }
    }
  } catch {
    /* ignore */
  }

  const unique: string[] = [];
  const u = new Set<string>();
  for (const w of merged) {
    const k = norm(w);
    if (!k || u.has(k)) continue;
    u.add(k);
    unique.push(w);
  }

  const ranked = pickDistractorEnglishWords(word, unique, [], YOUDAO_PROBE);
  const explains = await Promise.all(ranked.map((w) => fetchYoudaoExplain(w)));

  const distractors: SimilarWordDistractor[] = [];
  const seenZh = new Set<string>();

  for (let i = 0; i < ranked.length && distractors.length < 3; i++) {
    const w = ranked[i];
    const raw = explains[i];
    const zh = typeof raw === "string" ? raw.trim() : "";
    if (!zh || !looksLikeChinese(zh)) continue;
    const dk = glossDedupKey(zh);
    if (seenZh.has(dk)) continue;
    seenZh.add(dk);
    distractors.push({ word: w.trim(), explainZh: zh });
  }

  const targetKey = normalizeWordKey(word);
  return {
    distractors: distractors.filter((d) => normalizeWordKey(d.word) !== targetKey),
  };
}

/**
 * 干扰项列表：按 `canonicalWord` 走 Next `unstable_cache`（跨请求共享，与登录用户无关）。
 * - **MISS**：只会打印 `[similar-words] cache MISS (computing)`（见 `logSimilarWordsCacheMiss`，生产环境默认关闭）。
 * - **HIT**：不会进入上述日志；可在 Route 开启 `SIMILAR_WORDS_CACHE_LOG=1` 或开发环境看 `elapsedMs` 辅助判断。
 */
export async function getCachedSimilarWordDistractors(
  canonicalWord: string
): Promise<{ distractors: SimilarWordDistractor[] }> {
  return unstable_cache(
    async () => {
      logSimilarWordsCacheMiss(canonicalWord);
      return computeSimilarWordDistractors(canonicalWord);
    },
    ["similar-word-distractors", canonicalWord],
    { revalidate: SIMILAR_WORDS_CACHE_REVALIDATE_SEC, tags: ["similar-words"] }
  )();
}
