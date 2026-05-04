import {
  glossDedupKey,
  looksLikeChinese,
  normalizeWordKey,
  pickDistractorEnglishWords,
} from "@/lib/review-distractor-pick";
import { fetchYoudaoExplain } from "@/lib/youdao-suggest";
import { unstable_cacheLife } from "next/cache";
import { generateText } from "ai";
import { z } from "zod";

const PHRASE_LLM_MODEL = "zai/glm-4.7-flash" as const;

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

Output must strictly follow the JSON schema (3 items in "distractors").

CRITICAL: Emit exactly one JSON object, then stop. Never append a second JSON object, never repeat the same payload, and do not add any text before or after the JSON.`;
}

/** Handles models that concatenate two JSON objects; `JSON.parse` on the full string would fail. */
function sliceFirstJsonObject(text: string): string | null {
  const start = text.indexOf("{");
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (inString) {
      if (c === "\\") escape = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') {
      inString = true;
      continue;
    }
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
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

/**
 * Cached similar-word distractors for review quiz. Auth must stay in the Route Handler.
 * TTL aligned with Youdao fetch (~24h revalidate via `days` profile).
 */
export async function getCachedSimilarWordDistractors(
  canonicalWord: string
): Promise<{ distractors: SimilarWordDistractor[] }> {
  "use cache";
  unstable_cacheLife("days");

  // 仅在实际执行函数体时出现；命中 "use cache" 时不会进到这一行（可与 route 里每次请求的日志对比）
  console.log("[BOWEN_LOG] similar-words use-cache: MISS 执行完整计算", {
    canonicalWord,
    phrase: isMultiWordPhrase(canonicalWord),
  });

  const word = canonicalWord;

  if (isMultiWordPhrase(word)) {
    if (!process.env.AI_GATEWAY_API_KEY?.trim()) {
      return { distractors: [] };
    }
    const result = await generateText({
      model: PHRASE_LLM_MODEL,
      prompt: phraseDistractorPrompt(word),
    });
    const jsonSlice = sliceFirstJsonObject(result.text.trim());
    if (!jsonSlice) {
      throw new Error("Phrase distractors: model returned no JSON object");
    }
    const parsed = phraseDistractorsSchema.safeParse(JSON.parse(jsonSlice));
    if (!parsed.success) {
      throw new Error(`Phrase distractors: invalid shape — ${parsed.error.message}`);
    }
    const targetKey = normalizeWordKey(word);
    const filtered = parsed.data.distractors.filter(
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
