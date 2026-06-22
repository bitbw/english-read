import { requireSessionApi } from "@/lib/api-session";
import {
  canonicalSimilarWordsQuery,
  getCachedSimilarWordDistractors,
  getPhraseLlmErrorDebugInfo,
  isMultiWordPhrase,
} from "@/lib/similar-words-compute";
import { isAllowedPhraseLlmModel, resolvePhraseLlmModel } from "@/lib/similar-words-llm-models";
import { NextResponse } from "next/server";

/**
 * GET /api/review/similar-words?word=xxx
 * - 单词：Datamuse 近拼写 + 有道中文释义，最多 3 个干扰项。
 * - 短语（含空格的多词）：Vercel AI Gateway + 默认 `google/gemma-4-26b-a4b-it`，`generateText` + `Output.object`（Zod schema）。
 * - 计算结果由 `getCachedSimilarWordDistractors` 内 `unstable_cache` 按 canonical 词条 + 模型 id 缓存（跨用户共享）。
 *
 * 调试：`SIMILAR_WORDS_CACHE_LOG=1` 时打印每次请求的耗时；cache MISS 另有单独日志（生产默认关闭 MISS，见 similar-words-compute）。
 * 本地跳过缓存：`.env.local` 设 `SIMILAR_WORDS_CACHE_DISABLE=1`，或开发环境加 `?nocache=1`。
 * 本地切换模型：development 下加 `?model=provider/model-id`（须在 Free Tier 白名单内，见 similar-words-llm-models.ts）。
 */

export async function GET(req: Request) {
  const authResult = await requireSessionApi();
  if ("error" in authResult) return authResult.error;

  const { searchParams } = new URL(req.url);
  const word = searchParams.get("word")?.trim();
  if (!word) {
    return NextResponse.json({ error: "word parameter is required" }, { status: 400 });
  }

  const modelParam = searchParams.get("model")?.trim();
  if (modelParam) {
    if (process.env.NODE_ENV !== "development") {
      return NextResponse.json(
        { error: "model parameter is only allowed in development" },
        { status: 400 }
      );
    }
    if (!isAllowedPhraseLlmModel(modelParam)) {
      return NextResponse.json({ error: `Unknown or disallowed model: ${modelParam}` }, { status: 400 });
    }
  }

  if (isMultiWordPhrase(word) && !process.env.AI_GATEWAY_API_KEY?.trim()) {
    return NextResponse.json(
      { error: "AI_GATEWAY_API_KEY is required for phrase distractors" },
      { status: 503 }
    );
  }

  const canonical = canonicalSimilarWordsQuery(word);
  const bypassCache =
    process.env.SIMILAR_WORDS_CACHE_DISABLE === "1" ||
    (process.env.NODE_ENV === "development" && searchParams.get("nocache") === "1");
  const llmModel = modelParam ? resolvePhraseLlmModel(modelParam) : undefined;
  const logRoute =
    process.env.SIMILAR_WORDS_CACHE_LOG === "1" || process.env.NODE_ENV !== "production";
  const isDev = process.env.NODE_ENV === "development";

  const respond = async () => {
    const t0 = logRoute ? Date.now() : 0;
    const result = await getCachedSimilarWordDistractors(canonical, { bypassCache, llmModel });
    if (logRoute) {
      console.log("[similar-words] response", {
        canonical,
        model: result.llmModel,
        elapsedMs: Date.now() - t0,
      });
    }
    return NextResponse.json({
      distractors: result.distractors,
      ...(isDev && isMultiWordPhrase(word) ? { model: result.llmModel } : {}),
    });
  };

  if (isMultiWordPhrase(word)) {
    const activeModel = resolvePhraseLlmModel(modelParam);
    try {
      return await respond();
    } catch (e) {
      const message = e instanceof Error ? e.message : "LLM generation failed";
      const debug = isDev ? getPhraseLlmErrorDebugInfo(e, activeModel) : null;
      return NextResponse.json(
        debug ? { error: message, debug } : { error: message },
        { status: 502 }
      );
    }
  }

  return await respond();
}
