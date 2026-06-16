import { requireSessionApi } from "@/lib/api-session";
import {
  canonicalSimilarWordsQuery,
  getCachedSimilarWordDistractors,
  isMultiWordPhrase,
} from "@/lib/similar-words-compute";
import { NextResponse } from "next/server";

/**
 * GET /api/review/similar-words?word=xxx
 * - 单词：Datamuse 近拼写 + 有道中文释义，最多 3 个干扰项。
 * - 短语（含空格的多词）：Vercel AI Gateway + `deepseek/deepseek-v4-flash`，`generateText` + `Output.object`（Zod schema）。
 * - 计算结果由 `getCachedSimilarWordDistractors` 内 `unstable_cache` 按 canonical 词条缓存（跨用户共享）。
 *
 * 调试：`SIMILAR_WORDS_CACHE_LOG=1` 时打印每次请求的耗时；cache MISS 另有单独日志（生产默认关闭 MISS，见 similar-words-compute）。
 */

export async function GET(req: Request) {
  const authResult = await requireSessionApi();
  if ("error" in authResult) return authResult.error;

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
  const logRoute =
    process.env.SIMILAR_WORDS_CACHE_LOG === "1" || process.env.NODE_ENV !== "production";

  const respond = async () => {
    const t0 = logRoute ? Date.now() : 0;
    const { distractors } = await getCachedSimilarWordDistractors(canonical);
    if (logRoute) {
      console.log("[similar-words] response", {
        canonical,
        elapsedMs: Date.now() - t0,
      });
    }
    return NextResponse.json({ distractors });
  };

  if (isMultiWordPhrase(word)) {
    try {
      return await respond();
    } catch (e) {
      const message = e instanceof Error ? e.message : "LLM generation failed";
      return NextResponse.json({ error: message }, { status: 502 });
    }
  }

  return await respond();
}
