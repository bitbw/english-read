/** 服务端拉取 dictionaryapi.dev（无 API Key） */

export type FreeDictDefinition = {
  partOfSpeech: string;
  definition: string;
  example?: string;
};

export type FreeDictEntry = {
  phonetic: string;
  definitions: FreeDictDefinition[];
  /** dictionaryapi.dev media URL，文件名常见 *-uk.mp3 */
  audioUk?: string;
  /** dictionaryapi.dev media URL，文件名常见 *-us.mp3 */
  audioUs?: string;
};

const MAX_SHORT = 4;
const MAX_FULL = 24;

/**
 * 从 API 的 phonetics[] 提取英/美音频链接（依赖官方 mp3 命名里的 -uk / -us）。
 * 若无明确后缀，则使用第一个非空 audio 作为通用播放源（写入 audioUs，便于客户端 us||uk 播放）。
 */
export function pronunciationAudiosFromPhonetics(phonetics: unknown): {
  audioUk?: string;
  audioUs?: string;
} {
  const out: { audioUk?: string; audioUs?: string } = {};
  if (!Array.isArray(phonetics)) return out;

  for (const item of phonetics) {
    const audio =
      item &&
      typeof item === "object" &&
      typeof (item as { audio?: unknown }).audio === "string"
        ? (item as { audio: string }).audio.trim()
        : "";
    if (!audio) continue;
    const lower = audio.toLowerCase();
    if (!out.audioUk && (lower.includes("-uk.mp3") || lower.includes("_uk.mp3"))) {
      out.audioUk = audio;
    } else if (!out.audioUs && (lower.includes("-us.mp3") || lower.includes("_us.mp3"))) {
      out.audioUs = audio;
    }
  }

  if (!out.audioUk && !out.audioUs) {
    for (const item of phonetics) {
      const audio =
        item &&
        typeof item === "object" &&
        typeof (item as { audio?: unknown }).audio === "string"
          ? (item as { audio: string }).audio.trim()
          : "";
      if (audio) {
        out.audioUs = audio;
        break;
      }
    }
  }

  return out;
}

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

    const { audioUk, audioUs } = pronunciationAudiosFromPhonetics(entry.phonetics);

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

    return {
      phonetic,
      definitions,
      ...(audioUk ? { audioUk } : {}),
      ...(audioUs ? { audioUs } : {}),
    };
  } catch {
    return null;
  }
}
