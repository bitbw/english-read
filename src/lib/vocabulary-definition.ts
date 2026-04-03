/** 与 GET /api/dictionary 中英英义项结构一致 */
export type DictionaryDefinitionRow = {
  partOfSpeech: string;
  definition: string;
  example?: string;
};

/**
 * 序列化生词本的 definition 字段，与阅读弹窗「加入生词本」逻辑一致。
 */
export function serializeVocabularyDefinition(
  definitions: DictionaryDefinitionRow[],
  translation: string
): string | undefined {
  const translationTrim = translation.trim();
  if (definitions.length > 0) {
    return JSON.stringify(
      definitions.slice(0, 3).map((d) => ({
        pos: d.partOfSpeech,
        def: d.definition,
        ...(translationTrim ? { zh: translationTrim } : {}),
      }))
    );
  }
  if (translationTrim) {
    return JSON.stringify([{ pos: "译", def: translationTrim, zh: translationTrim }]);
  }
  return undefined;
}
