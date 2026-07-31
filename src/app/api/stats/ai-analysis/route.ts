import { requireSessionApi } from "@/lib/api-session";
import { getStudyStats, resolveStudyDayRange } from "@/lib/study-stats";
import { resolveTimeZone } from "@/lib/user-timezone";
import { calendarDayKeysBetween } from "@/lib/user-calendar";
import { generateText } from "ai";
import { NextResponse } from "next/server";

/** AI 分析使用的模型，可直接修改此值切换模型 */
const AI_ANALYSIS_MODEL = "moonshotai/kimi-k2.7-code";

function buildDigest(
  days: number,
  start: string,
  end: string,
  totals: {
    readingSeconds: number;
    avgWpm: number | null;
    reviewedCount: number;
    errorCount: number;
    totalVocabAdded: number;
    errorRate: number | null;
    avgDailyReadingMins: number;
    avgDailyReviewMins: number;
    readingWords: number;
  },
  activeDays: number,
) {
  const readingMin = Math.round(totals.readingSeconds / 60);
  const dailyReadingMin = totals.avgDailyReadingMins;
  const dailyReviewMin = totals.avgDailyReviewMins;
  const wpm = totals.avgWpm ?? 0;
  const errorRate = totals.errorRate ?? 0;

  return `学习数据摘要（${start} 至 ${end}，共 ${days} 天）：
- 有效学习天数：${activeDays} 天
- 总阅读时长：${readingMin} 分钟（日均 ${dailyReadingMin} 分钟）
- 总阅读词汇量：${totals.readingWords} 词
- 平均阅读速度：${wpm} 词/分钟
- 新增生词：${totals.totalVocabAdded} 个
- 复习词数：${totals.reviewedCount} 次（日均复习 ${dailyReviewMin} 分钟）
- 复习错误：${totals.errorCount} 次（错误率 ${errorRate}%）`;
}

function extractJson(text: string): Record<string, unknown> | null {
  // 尝试解析整段文本为 JSON
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    // 不是纯 JSON，尝试提取 ```json ... ``` 代码块
  }

  const jsonBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonBlockMatch) {
    try {
      return JSON.parse(jsonBlockMatch[1]!.trim()) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  // 尝试找到第一个 { 到最后一个 }
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try {
      return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1)) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  return null;
}

function extractAnalysisText(raw: unknown): string {
  if (typeof raw === "string") return raw;
  if (raw && typeof raw === "object") {
    // 尝试拼接对象各字段
    const parts: string[] = [];
    for (const v of Object.values(raw as Record<string, unknown>)) {
      if (typeof v === "string") parts.push(v);
    }
    if (parts.length > 0) return parts.join("\n\n");
  }
  return "";
}

function extractSuggestions(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item: unknown) => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object") {
        const obj = item as Record<string, unknown>;
        // action + detail 结构 → "action: detail"
        const action = typeof obj.action === "string" ? obj.action : "";
        const detail = typeof obj.detail === "string" ? obj.detail : "";
        if (action && detail) return `${action}：${detail}`;
        // 取第一个字符串字段
        const firstStr = Object.values(obj).find((v): v is string => typeof v === "string");
        if (firstStr) return firstStr;
      }
      return null;
    })
    .filter((s): s is string => s !== null && s.length > 0);
}

async function generateAnalysis(digest: string, locale: string): Promise<{ analysis: string; suggestions: string[] }> {
  const langInstruction = locale === "en"
    ? "Please respond in English."
    : "请用中文回复。";

  const prompt = `你是一位专业英语学习顾问。根据用户的学习数据，提供简要的分析和可操作的改进建议。

要求：
1. 分析 100~200 字，涵盖阅读量、速度、复习情况和错误趋势
2. 给出 3 条具体可执行的建议
3. ${langInstruction}

请用以下 JSON 格式返回（不要加 \`\`\` 标记）：
{
  "analysis": "你的分析文本",
  "suggestions": ["建议1", "建议2", "建议3"]
}

学习数据：
${digest}`;

  const result = await generateText({
    model: AI_ANALYSIS_MODEL,
    prompt,
  });

  const rawText = result.text;
  console.log("[ai-analysis] LLM raw text:", rawText);

  // 尝试解析 JSON
  const parsed = extractJson(rawText);
  if (parsed) {
    const analysis = extractAnalysisText(parsed.analysis) || rawText.slice(0, 500);
    const suggestions = extractSuggestions(parsed.suggestions);
    return { analysis, suggestions };
  }

  // JSON 解析失败，把全文当分析，生成默认建议
  console.error("[ai-analysis] Failed to parse JSON from LLM response, falling back to plain text");
  return {
    analysis: rawText.slice(0, 500),
    suggestions: ["增加每日阅读时长，保持连续学习", "定期复习已学生词，降低错误率", "尝试阅读更高难度的文章扩大词汇量"],
  };
}

export async function POST(req: Request) {
  const authResult = await requireSessionApi();
  if ("error" in authResult) return authResult.error;
  const userId = authResult.session.user.id;

  if (!process.env.AI_GATEWAY_API_KEY?.trim()) {
    return NextResponse.json(
      { error: "AI analysis is not available" },
      { status: 503 },
    );
  }

  let body: { days?: number; locale?: string };
  try {
    body = (await req.json()) as { days?: number; locale?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const days = body.days ?? 14;
  const locale = body.locale ?? "zh";
  if (days < 1 || days > 90 || !Number.isFinite(days)) {
    return NextResponse.json({ error: "days must be between 1 and 90" }, { status: 400 });
  }

  const timeZone = await resolveTimeZone(userId, req);

  const searchParams = new URLSearchParams({ days: String(days) });
  const range = resolveStudyDayRange(searchParams, timeZone);
  if ("error" in range) {
    return NextResponse.json({ error: range.error }, { status: 400 });
  }

  const data = await getStudyStats(userId, timeZone, range);

  const actualDays = calendarDayKeysBetween(range.start, range.end, timeZone).length;

  const activeDays = data.series.filter(
    (s) => s.readingSeconds > 0 || s.reviewSeconds > 0,
  ).length;

  const digest = buildDigest(actualDays, range.start, range.end, data.totals, activeDays);

  try {
    const result = await generateAnalysis(digest, locale);
    return NextResponse.json(result);
  } catch (e) {
    console.error("[ai-analysis] LLM generation failed:", e instanceof Error ? e.message : String(e));
    return NextResponse.json({ error: "AI analysis failed, please try again later" }, { status: 502 });
  }
}