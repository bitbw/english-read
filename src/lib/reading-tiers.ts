/**
 * 与 docs/books/分级阅读.md 一致的五个阅读级别（用于公共书库分级与筛选）。
 */

export const READING_TIER_IDS = ["1k", "2k", "3k", "4k", "5k"] as const;

export type ReadingTierId = (typeof READING_TIER_IDS)[number];

/** 仅用于 LLM 分级提示（中文，与 docs 一致）；界面文案见 messages `library.readingTier.*` */
const TIER_LABEL_ZH_FOR_PROMPT: Record<ReadingTierId, string> = {
  "1k": "入门 1K",
  "2k": "初级 2K",
  "3k": "中级 3K",
  "4k": "进阶 4K",
  "5k": "高级 5K",
};

export const READING_TIERS: {
  id: ReadingTierId;
  /** 给 LLM 的简短说明 */
  llmHint: string;
}[] = [
  {
    id: "1k",
    llmHint:
      "词汇量约 500–1000，句子简短，常配插图；适合绘本、极简分级读物、Starter 级简写。",
  },
  {
    id: "2k",
    llmHint:
      "词汇量约 1000–2000，简单日常对话与短篇儿童文学；如经典童书、Magic Tree House 难度。",
  },
  {
    id: "3k",
    llmHint:
      "词汇量约 2000–3500，青少年小说、奇幻长篇入门；如 Harry Potter 第一本、Wonder 一类。",
  },
  {
    id: "4k",
    llmHint:
      "词汇量约 3500–5000，青少年向原版与部分成人文学；情节与句式更复杂。",
  },
  {
    id: "5k",
    llmHint:
      "词汇量 5000+，经典文学、非虚构、学术通俗读物；修辞与抽象概念更多。",
  },
];

const tierSet = new Set<string>(READING_TIER_IDS);

export function isReadingTierId(v: string): v is ReadingTierId {
  return tierSet.has(v);
}

/** 拼进 LLM 的分级列表说明 */
export function buildTierPromptBlock(): string {
  return READING_TIERS.map(
    (t) => `- ${t.id}: ${TIER_LABEL_ZH_FOR_PROMPT[t.id]} — ${t.llmHint}`
  ).join("\n");
}
