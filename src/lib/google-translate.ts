/**
 * Google Cloud Translation API v2（REST），见 docs/google.md。
 * POST https://translation.googleapis.com/language/translate/v2?key=...
 */
const ENDPOINT = "https://translation.googleapis.com/language/translate/v2";

export async function fetchGoogleTranslateEnToZh(q: string): Promise<string | null> {
  const trimmed = q.trim();
  if (!trimmed) return null;

  const key = process.env.GOOGLE_TRANSLATE_API_KEY?.trim();
  if (!key) return null;

  try {
    const url = new URL(ENDPOINT);
    url.searchParams.set("key", key);

    const res = await fetch(url.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        q: trimmed,
        target: "zh-CN",
        source: "en",
        format: "text",
      }),
      next: { revalidate: 86400 },
    });

    if (!res.ok) return null;

    const data = (await res.json()) as {
      data?: { translations?: Array<{ translatedText?: string }> };
    };
    const t = data.data?.translations?.[0]?.translatedText;
    if (typeof t !== "string") return null;
    const out = t.trim();
    return out || null;
  } catch {
    return null;
  }
}
