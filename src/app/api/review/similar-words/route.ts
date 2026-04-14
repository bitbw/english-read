import { auth } from "@/lib/auth";
import {
  glossDedupKey,
  looksLikeChinese,
  pickDistractorEnglishWords,
} from "@/lib/review-distractor-pick";
import { fetchYoudaoExplain } from "@/lib/youdao-suggest";
import { generateText, Output } from "ai";
import { NextResponse } from "next/server";
import { z } from "zod";

/**
 * GET /api/review/similar-words?word=xxx
 * - 单词：Datamuse 近拼写 + 有道中文释义，最多 3 个干扰项。
 * - 短语（含空格的多词）：Vercel AI Gateway + `zai/glm-4.7-flash`，`generateText` + `Output.object` 生成 3 条。
 */

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

function isMultiWordPhrase(word: string): boolean {
  return word.trim().split(/\s+/).filter(Boolean).length > 1;
}

function phraseDistractorPrompt(phrase: string): string {
  const quoted = JSON.stringify(phrase);
  return `You are helping build English vocabulary quiz wrong answers.

Target English phrase (must NOT appear verbatim as any "word" field, case-insensitive):
${quoted}

Return exactly 3 different English phrases that could be confused with the target in a multiple-choice test:
- similar spelling and/or similar pronunciation (including plausible mis-hearings or typos as multi-word phrases),
- natural English (realistic collocations or common phrases when possible),
- each phrase distinct from the others and from the target.

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
/** 并行有道请求上限；从中筛出 3 条有效中文释义 */
const YOUDAO_PROBE = 14;

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const word = searchParams.get("word")?.trim();
  if (!word) {
    return NextResponse.json({ error: "word parameter is required" }, { status: 400 });
  }

  if (isMultiWordPhrase(word)) {
    if (!process.env.AI_GATEWAY_API_KEY?.trim()) {
      return NextResponse.json(
        { error: "AI_GATEWAY_API_KEY is required for phrase distractors" },
        { status: 503 }
      );
    }
    try {
      const result = await generateText({
        model: PHRASE_LLM_MODEL,
        output: Output.object({ schema: phraseDistractorsSchema }),
        prompt: phraseDistractorPrompt(word),
      });
      return NextResponse.json({ distractors: result.output.distractors });
    } catch (e) {
      const message = e instanceof Error ? e.message : "LLM generation failed";
      return NextResponse.json({ error: message }, { status: 502 });
    }
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
    return NextResponse.json({ distractors: [] as { word: string; explainZh: string }[] });
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

  const distractors: { word: string; explainZh: string }[] = [];
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

  return NextResponse.json({ distractors });
}
