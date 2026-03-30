import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

// GET /api/dictionary?word=xxx
// 代理 Free Dictionary API，避免前端 CORS 问题
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

  const cleanWord = word.trim().toLowerCase().replace(/[^a-z\-']/g, "");
  if (!cleanWord) {
    return NextResponse.json({ definitions: [] });
  }

  try {
    const res = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(cleanWord)}`,
      { next: { revalidate: 86400 } } // 缓存 24 小时
    );

    if (!res.ok) {
      return NextResponse.json({ definitions: [] });
    }

    const data = await res.json();
    const entry = Array.isArray(data) ? data[0] : null;

    if (!entry) {
      return NextResponse.json({ definitions: [] });
    }

    // 提取音标
    const phonetic =
      entry.phonetic ||
      entry.phonetics?.find((p: { text?: string }) => p.text)?.text ||
      "";

    // 提取释义（每个词性取前2条）
    const definitions: { partOfSpeech: string; definition: string; example?: string }[] = [];
    for (const meaning of entry.meanings ?? []) {
      for (const def of (meaning.definitions ?? []).slice(0, 2)) {
        definitions.push({
          partOfSpeech: meaning.partOfSpeech,
          definition: def.definition,
          example: def.example,
        });
      }
    }

    return NextResponse.json({ phonetic, definitions });
  } catch {
    return NextResponse.json({ definitions: [] });
  }
}
