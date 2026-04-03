/**
 * 有道词典 suggest 接口（与 docs/API.md 一致）。
 * GET http://dict.youdao.com/suggest?q=...&num=1&doctype=json
 * 取 data.entries[0].explain 作为词典式中文释义（含词性），适合单词展示。
 */
export async function fetchYoudaoExplain(q: string): Promise<string | null> {
  const trimmed = q.trim();
  if (!trimmed) return null;

  try {
    const url = `http://dict.youdao.com/suggest?q=${encodeURIComponent(trimmed)}&num=1&doctype=json`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "english-read/1.0 (dictionary)",
      },
      next: { revalidate: 86400 },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      result?: { code?: number };
      data?: { entries?: Array<{ explain?: string }> };
    };
    if (data.result?.code !== 200) return null;
    const entries = data.data?.entries;
    if (!Array.isArray(entries) || entries.length === 0) return null;
    const explain = typeof entries[0]?.explain === "string" ? entries[0].explain.trim() : "";
    return explain || null;
  } catch {
    return null;
  }
}
