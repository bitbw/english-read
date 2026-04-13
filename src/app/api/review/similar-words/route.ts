import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

/**
 * GET /api/review/similar-words?word=xxx
 * 用 Datamuse（无需 API Key）按拼写模式 `sp` 取与当前词「词形/拼写」相近的英文词，供释义四选一作干扰项（避免 ml/rel_trg 近义导致中文义项难辨）。
 */

function lettersKey(w: string): string {
  return w.toLowerCase().replace(/[^a-z]/g, "");
}

function buildSpPatterns(base: string): string[] {
  const n = base.length;
  if (n === 0) return [];
  if (n <= 2) return [`${base}*`];
  if (n === 3) return [`${base.slice(0, 2)}*`];
  const patterns = [`${base.slice(0, 3)}*`, `*${base.slice(-3)}`];
  if (n >= 6) {
    patterns.push(`${base.slice(0, 2)}?${base.slice(-2)}`);
  }
  return patterns;
}

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

  const firstToken = word.trim().split(/\s+/)[0] ?? "";
  const base = lettersKey(firstToken);
  const targetFullKey = lettersKey(word);

  const norm = (w: string) => w.toLowerCase().replace(/[^a-z\s]/g, "").replace(/\s+/g, " ").trim();

  const maxLenDiff = base.length <= 2 ? 2 : 4;

  const acceptCandidate = (raw: string): string | null => {
    const w = raw.trim();
    if (!w || /[^a-zA-Z\s\-']/.test(w.replace(/\s/g, ""))) return null;
    const ck = lettersKey(w);
    if (!ck || ck === targetFullKey) return null;
    if (Math.abs(ck.length - base.length) > maxLenDiff) return null;
    return w;
  };

  if (!base) {
    return NextResponse.json({ words: [] });
  }

  const patterns = buildSpPatterns(base);
  const merged: string[] = [];

  try {
    const fetches = patterns.map((sp) =>
      fetch(`https://api.datamuse.com/words?sp=${encodeURIComponent(sp)}&max=22`, {
        next: { revalidate: 3600 },
      })
    );
    const responses = await Promise.all(fetches);
    for (const res of responses) {
      if (!res.ok) continue;
      const data = (await res.json()) as { word?: string }[];
      for (const it of data) {
        const ok = acceptCandidate(it.word ?? "");
        if (ok) merged.push(ok);
      }
    }
  } catch {
    /* ignore */
  }

  const unique: string[] = [];
  const u = new Set<string>();
  for (const w of merged) {
    const k = norm(w);
    if (!k || u.has(k)) continue;
    u.add(k);
    unique.push(w);
  }

  return NextResponse.json({ words: unique.slice(0, 40) });
}
