/** 与 GET /api/dictionary 中英英义项结构一致 */
export type DictionaryDefinitionRow = {
  partOfSpeech: string;
  definition: string;
  example?: string;
};

function translateEntry(translationTrim: string) {
  return { pos: "译" as const, def: translationTrim, zh: translationTrim };
}

/**
 * 序列化生词本的 definition 字段：
 * - 中文固定为首条 `{ pos: "译", def, zh }`（二者同文，便于只读 zh 的逻辑）。
 * - 英英义项最多 2 条，只含 pos/def，不再重复 zh。
 */
export function serializeVocabularyDefinition(
  definitions: DictionaryDefinitionRow[],
  translation: string
): string | undefined {
  const translationTrim = translation.trim();
  const english = definitions.slice(0, 2).map((d) => ({
    pos: d.partOfSpeech,
    def: d.definition,
  }));

  if (translationTrim && english.length > 0) {
    return JSON.stringify([translateEntry(translationTrim), ...english]);
  }
  if (english.length > 0) {
    return JSON.stringify(english);
  }
  if (translationTrim) {
    return JSON.stringify([translateEntry(translationTrim)]);
  }
  return undefined;
}
