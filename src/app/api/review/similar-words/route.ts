import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

/**
 * GET /api/review/similar-words?word=xxx
 * 用 Datamuse（无需 API Key）取与当前词「搭配共现 / 联想」相关的英文词作释义干扰项，
 * 不足时辅以词库内近形词 word 列表（由客户端传入或二次请求）。
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

  const q = encodeURIComponent(word.toLowerCase());
  const seen = new Set<string>();
  const norm = (w: string) => w.toLowerCase().replace(/[^a-z\s]/g, "").replace(/\s+/g, " ").trim();
  const targetNorm = norm(word);
  if (targetNorm) seen.add(targetNorm);

  const addWords = (items: { word?: string }[]) => {
    const out: string[] = [];
    for (const it of items) {
      const w = (it.word ?? "").trim();
      if (!w || /[^a-zA-Z\s\-']/.test(w.replace(/\s/g, ""))) continue;
      const n = norm(w);
      if (!n || seen.has(n)) continue;
      seen.add(n);
      out.push(w);
    }
    return out;
  };

  const merged: string[] = [];

  try {
    const [trgRes, mlRes] = await Promise.all([
      fetch(`https://api.datamuse.com/words?rel_trg=${q}&max=30`, { next: { revalidate: 3600 } }),
      fetch(`https://api.datamuse.com/words?ml=${q}&max=20`, { next: { revalidate: 3600 } }),
    ]);

    if (trgRes.ok) {
      const data = (await trgRes.json()) as { word?: string }[];
      merged.push(...addWords(data));
    }
    if (mlRes.ok) {
      const data = (await mlRes.json()) as { word?: string }[];
      merged.push(...addWords(data));
    }
  } catch {
    /* ignore */
  }

  // 优先用 rel_trg 靠前的联想词，避免全被 ml 同义词占满（中文义易撞车）
  const unique: string[] = [];
  const u = new Set<string>();
  for (const w of merged) {
    const k = norm(w);
    if (u.has(k)) continue;
    u.add(k);
    unique.push(w);
  }

  return NextResponse.json({ words: unique.slice(0, 40) });
}
