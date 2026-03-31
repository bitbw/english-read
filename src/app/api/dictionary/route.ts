import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

// GET /api/dictionary?word=xxx
// 代理 Free Dictionary API（英文释义）+ MyMemory（中文翻译）
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const word = searchParams.get("word");

  if (!word || word.trim().length === 0) {
    return NextResponse.json({ error: "word parameter is required" }, { status: 400 });
  }

  const trimmed = word.trim();
  const isPhrase = trimmed.split(/\s+/).length > 1;

  let phonetic = "";
  let definitions: { partOfSpeech: string; definition: string; example?: string }[] = [];
  let translation = "";

  // 单词才查英英词典
  if (!isPhrase) {
    const cleanWord = trimmed.toLowerCase().replace(/[^a-z\-']/g, "");
    if (cleanWord) {
      try {
        const res = await fetch(
          `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(cleanWord)}`,
          { next: { revalidate: 86400 } }
        );
        if (res.ok) {
          const data = await res.json();
          const entry = Array.isArray(data) ? data[0] : null;
          if (entry) {
            phonetic =
              entry.phonetic ||
              entry.phonetics?.find((p: { text?: string }) => p.text)?.text ||
              "";
            for (const meaning of entry.meanings ?? []) {
              for (const def of (meaning.definitions ?? []).slice(0, 2)) {
                definitions.push({
                  partOfSpeech: meaning.partOfSpeech,
                  definition: def.definition,
                  example: def.example,
                });
              }
            }
          }
        }
      } catch { /* silent */ }
    }
  }

  // 中文翻译（单词和短语均查）
  try {
    const res = await fetch(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(trimmed)}&langpair=en|zh`,
      { next: { revalidate: 86400 } }
    );
    if (res.ok) {
      const data = await res.json();
      const t = data.responseData?.translatedText ?? "";
      // MyMemory 有时会返回 HTML 实体或错误消息，过滤掉
      if (t && !t.startsWith("PLEASE SELECT") && !t.includes("MYMEMORY")) {
        translation = t;
      }
    }
  } catch { /* silent */ }

  return NextResponse.json({ phonetic, definitions, translation });
}
