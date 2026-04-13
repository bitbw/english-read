import { auth } from "@/lib/auth";
import { fetchFreeDictionaryEn } from "@/lib/free-dictionary";
import { fetchGoogleTranslateEnToZh } from "@/lib/google-translate";
import { fetchYoudaoExplain } from "@/lib/youdao-suggest";
import { NextResponse } from "next/server";

/** 选区内不得含标点（英文/数字、空白、撇号、连字符、弯撇号） */
function hasPunctuationInSelection(s: string): boolean {
  return /[^a-zA-Z0-9\s'\u2019-]/.test(s);
}

function wordTokenCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

/** 无标点且 1～5 个词：尝试有道 suggest（单词 + 短短语） */
function shouldTryYoudaoSuggest(trimmed: string): boolean {
  const n = wordTokenCount(trimmed);
  return n >= 1 && n <= 5 && !hasPunctuationInSelection(trimmed);
}

/** 仅单个无标点词：查 Free Dictionary 英英与发音 */
function shouldFetchFreeDictionary(trimmed: string): boolean {
  return wordTokenCount(trimmed) === 1 && !hasPunctuationInSelection(trimmed);
}

/**
 * GET /api/dictionary?word=...&full=1
 *
 * 聚合上游能力，供阅读器划词弹窗、复习等调用：
 * 1. dictionaryapi.dev（经 fetchFreeDictionaryEn）：仅「单个无标点英文词」的音标、英英释义与发音 mp3。
 * 2. 有道 suggest（docs/API.md）：无标点且 1～5 词时作 translation（entries[0].explain）；失败或无结果则回退。
 * 3. Google Translation v2（docs/google.md）：环境变量 GOOGLE_TRANSLATE_API_KEY；有道不可用或无译文时使用。
 *
 * 查询参数：
 * - word：必填，会先 trim；可与阅读器选区一致（最长由阅读器侧限制）。
 * - full=1：仅影响英英义项条数（short / full），见 free-dictionary.ts。
 * - youdaoOnly=1：只调有道 suggest（fetchYoudaoExplain），不查 Free Dictionary、不回落 Google；仅当无标点且 1～5 词时有效，否则 translation 为空。
 *
 * 返回 JSON：{ phonetic, definitions, translation, audioUk?, audioUs? }
 * - 长句/含标点：definitions / audio* 通常为空，仍可能带 translation（Google）。
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
  /** 仅译文且要快：只走有道，与阅读器全量查词分离 */
  const youdaoOnly = searchParams.get("youdaoOnly") === "1";

  if (!word || word.trim().length === 0) {
    return NextResponse.json({ error: "word parameter is required" }, { status: 400 });
  }

  const trimmed = word.trim();

  let phonetic = "";
  let definitions: { partOfSpeech: string; definition: string; example?: string }[] = [];
  let translation = "";
  let audioUk = "";
  let audioUs = "";

  const tryYoudao = shouldTryYoudaoSuggest(trimmed);
  const tryFreeDict = shouldFetchFreeDictionary(trimmed);

  if (youdaoOnly) {
    if (tryYoudao) {
      const youdao = await fetchYoudaoExplain(trimmed);
      if (youdao) translation = youdao;
    }
    return NextResponse.json({
      phonetic: "",
      definitions: [],
      translation,
    });
  }

  if (tryFreeDict) {
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
  } else if (tryYoudao) {
    const youdao = await fetchYoudaoExplain(trimmed);
    if (youdao) translation = youdao;
  }

  if (!translation) {
    /*
    try {
      const res = await fetch(
        `https://api.mymemory.translated.net/get?q=${encodeURIComponent(trimmed)}&langpair=en|zh`,
        // 86400s = 24h，与 Next 数据缓存策略一致
        { next: { revalidate: 86400 } }
      );
      if (res.ok) {
        const data = await res.json();
        const t = data.responseData?.translatedText ?? "";
        // 免费额度用尽或异常时，MyMemory 常在 translatedText 里返回提示英文
        //（如 PLEASE SELECT、MYMEMORY 字样）；过滤掉，避免当「译文」展示。
        if (t && !t.startsWith("PLEASE SELECT") && !t.includes("MYMEMORY")) {
          translation = t;
        }
      }
    } catch {
      // 翻译失败不影响返回英英部分，静默即可
    }
    */

    const google = await fetchGoogleTranslateEnToZh(trimmed);
    if (google) translation = google;
  }

  return NextResponse.json({
    phonetic,
    definitions,
    translation,
    ...(audioUk ? { audioUk } : {}),
    ...(audioUs ? { audioUs } : {}),
  });
}
