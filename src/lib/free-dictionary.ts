/** 服务端拉取 dictionaryapi.dev（无 API Key） */

export type FreeDictDefinition = {
  partOfSpeech: string;
  definition: string;
  example?: string;
};

export type FreeDictEntry = {
  phonetic: string;
  definitions: FreeDictDefinition[];
};

const MAX_SHORT = 4;
const MAX_FULL = 24;

export async function fetchFreeDictionaryEn(
  word: string,
  mode: "short" | "full"
): Promise<FreeDictEntry | null> {
  const trimmed = word.trim();
  const isPhrase = trimmed.split(/\s+/).length > 1;
  if (isPhrase) return null;

  const cleanWord = trimmed.toLowerCase().replace(/[^a-z\-']/g, "");
  if (!cleanWord) return null;

  const cap = mode === "full" ? MAX_FULL : MAX_SHORT;

  try {
    const res = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(cleanWord)}`,
      { next: { revalidate: 86400 } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const entry = Array.isArray(data) ? data[0] : null;
    if (!entry) return null;

    const phonetic =
      entry.phonetic ||
      entry.phonetics?.find((p: { text?: string }) => p.text)?.text ||
      "";

    const definitions: FreeDictDefinition[] = [];
    for (const meaning of entry.meanings ?? []) {
      const pos = meaning.partOfSpeech ?? "";
      for (const def of meaning.definitions ?? []) {
        if (definitions.length >= cap) break;
        if (def.definition) {
          definitions.push({
            partOfSpeech: pos,
            definition: def.definition,
            example: def.example,
          });
        }
      }
      if (definitions.length >= cap) break;
    }

    return { phonetic, definitions };
  } catch {
    return null;
  }
}
