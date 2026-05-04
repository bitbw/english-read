import { auth } from "@/lib/auth";
import {
  canonicalSimilarWordsQuery,
  getCachedSimilarWordDistractors,
  isMultiWordPhrase,
} from "@/lib/similar-words-compute";
import { NextResponse } from "next/server";

/**
 * GET /api/review/similar-words?word=xxx
 * - 单词：Datamuse 近拼写 + 有道中文释义，最多 3 个干扰项。
 * - 短语（含空格的多词）：Vercel AI Gateway + `zai/glm-4.7-flash`，`generateText` + `Output.object` 生成 3 条。
 * - 计算结果由 `getCachedSimilarWordDistractors` 内 `"use cache"` 缓存（需 `experimental.useCache`，见 next.config.mjs）。
 */

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

  if (isMultiWordPhrase(word) && !process.env.AI_GATEWAY_API_KEY?.trim()) {
    return NextResponse.json(
      { error: "AI_GATEWAY_API_KEY is required for phrase distractors" },
      { status: 503 }
    );
  }

  const canonical = canonicalSimilarWordsQuery(word);

  if (isMultiWordPhrase(word)) {
    try {
      const { distractors } = await getCachedSimilarWordDistractors(canonical);
      return NextResponse.json({ distractors });
    } catch (e) {
      const message = e instanceof Error ? e.message : "LLM generation failed";
      return NextResponse.json({ error: message }, { status: 502 });
    }
  }

  const { distractors } = await getCachedSimilarWordDistractors(canonical);
  return NextResponse.json({ distractors });
}
