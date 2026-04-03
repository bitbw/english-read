import { auth } from "@/lib/auth";
import { fetchFreeDictionaryEn } from "@/lib/free-dictionary";
import { fetchYoudaoExplain } from "@/lib/youdao-suggest";
import { NextResponse } from "next/server";

/**
 * GET /api/dictionary?word=...&full=1
 *
 * 聚合上游能力，供阅读器划词弹窗、复习等调用：
 * 1. dictionaryapi.dev（经 fetchFreeDictionaryEn）：仅「单个英文词」的音标、英英释义与发音 mp3。
 * 2. 有道 suggest（docs/API.md）：仅「单个英文词」时用作 translation（entries[0].explain，词典释义优于机翻）。
 * 3. MyMemory：短语/整句的英译中，或单词在有道无结果时的回退。
 *
 * 查询参数：
 * - word：必填，会先 trim；可与阅读器选区一致（最长由阅读器侧限制）。
 * - full=1：仅影响英英义项条数（short / full），见 free-dictionary.ts。
 *
 * 返回 JSON：{ phonetic, definitions, translation, audioUk?, audioUs? }
 * - 词组/句子：definitions / audio* 通常为空，仍可能带 translation。
 * - 响应按 revalidate 缓存 24h，减轻外网压力。
 */
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const word = searchParams.get("word");
  /** 复习翻面等需要更多义项时传 full=1；默认 short 条数较少 */
  const full = searchParams.get("full") === "1";

  if (!word || word.trim().length === 0) {
    return NextResponse.json({ error: "word parameter is required" }, { status: 400 });
  }

  const trimmed = word.trim();
  /** 按空白分词：多于一个 token 视为短语/句子，不调 Free Dictionary（该 API 不按整句查） */
  const isPhrase = trimmed.split(/\s+/).length > 1;

  let phonetic = "";
  let definitions: { partOfSpeech: string; definition: string; example?: string }[] = [];
  let translation = "";
  let audioUk = "";
  let audioUs = "";

  if (!isPhrase) {
    const [entry, youdao] = await Promise.all([
      fetchFreeDictionaryEn(trimmed, full ? "full" : "short"),
      fetchYoudaoExplain(trimmed),
    ]);
    if (entry) {
      phonetic = entry.phonetic;
      definitions = entry.definitions;
      audioUk = entry.audioUk ?? "";
      audioUs = entry.audioUs ?? "";
    }
    if (youdao) translation = youdao;
  }

  if (!translation) {
    try {
      const res = await fetch(
        `https://api.mymemory.translated.net/get?q=${encodeURIComponent(trimmed)}&langpair=en|zh`,
        /** 86400s = 24h，与 Next 数据缓存策略一致 */
        { next: { revalidate: 86400 } }
      );
      if (res.ok) {
        const data = await res.json();
        const t = data.responseData?.translatedText ?? "";
        /**
         * 免费额度用尽或异常时，MyMemory 常在 translatedText 里返回提示英文
         *（如 PLEASE SELECT、MYMEMORY 字样）；过滤掉，避免当「译文」展示。
         */
        if (t && !t.startsWith("PLEASE SELECT") && !t.includes("MYMEMORY")) {
          translation = t;
        }
      }
    } catch {
      /* 翻译失败不影响返回英英部分，静默即可 */
    }
  }

  return NextResponse.json({
    phonetic,
    definitions,
    translation,
    ...(audioUk ? { audioUk } : {}),
    ...(audioUs ? { audioUs } : {}),
  });
}
