import { auth } from "@/lib/auth";
import { fetchFreeDictionaryEn } from "@/lib/free-dictionary";
import { NextResponse } from "next/server";

// GET /api/dictionary?word=xxx[&full=1]
// 代理 Free Dictionary API（英文释义）+ MyMemory（中文翻译）
// full=1 时返回更多义项（复习翻面 / 词典式展示）
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const word = searchParams.get("word");
  const full = searchParams.get("full") === "1";

  if (!word || word.trim().length === 0) {
    return NextResponse.json({ error: "word parameter is required" }, { status: 400 });
  }

  const trimmed = word.trim();
  const isPhrase = trimmed.split(/\s+/).length > 1;

  let phonetic = "";
  let definitions: { partOfSpeech: string; definition: string; example?: string }[] = [];
  let translation = "";

  if (!isPhrase) {
    const entry = await fetchFreeDictionaryEn(trimmed, full ? "full" : "short");
    if (entry) {
      phonetic = entry.phonetic;
      definitions = entry.definitions;
    }
  }

  try {
    const res = await fetch(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(trimmed)}&langpair=en|zh`,
      { next: { revalidate: 86400 } }
    );
    if (res.ok) {
      const data = await res.json();
      const t = data.responseData?.translatedText ?? "";
      if (t && !t.startsWith("PLEASE SELECT") && !t.includes("MYMEMORY")) {
        translation = t;
      }
    }
  } catch {
    /* silent */
  }

  return NextResponse.json({ phonetic, definitions, translation });
}
