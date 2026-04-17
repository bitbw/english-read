import { generateText, Output } from "ai";
import { z } from "zod";
import {
  buildTierPromptBlock,
  type ReadingTierId,
  isReadingTierId,
  READING_TIER_IDS,
} from "@/lib/reading-tiers";

const TIER_MODEL = "zai/glm-4.7-flash" as const;

const tierOutputSchema = z.object({
  tier: z.enum(READING_TIER_IDS),
});

function tierPrompt(title: string, author: string): string {
  const t = JSON.stringify(title);
  const a = JSON.stringify(author || "");
  return `You classify English books for graded reading. Pick exactly ONE tier id for the book.

Book title: ${t}
Author (may be empty): ${a}

Tiers (choose tier id only from this list):
${buildTierPromptBlock()}

Rules:
- Output JSON only, matching the schema: { "tier": "1k"|"2k"|"3k"|"4k"|"5k" }.
- Base judgment on typical language difficulty for an English learner reading the original book.
- If unknown, prefer a conservative middle tier (e.g. 3k).`;
}

export type TierSource = "llm" | "fallback";

export async function assignPublicReadingTier(
  title: string,
  author: string
): Promise<{ tier: ReadingTierId; tierSource: TierSource }> {
  const safeTitle = title.trim() || "Unknown";
  const safeAuthor = author.trim();

  if (!process.env.AI_GATEWAY_API_KEY?.trim()) {
    return { tier: "3k", tierSource: "fallback" };
  }

  try {
    const result = await generateText({
      model: TIER_MODEL,
      output: Output.object({ schema: tierOutputSchema }),
      prompt: tierPrompt(safeTitle, safeAuthor),
    });
    const tier = result.output.tier;
    if (isReadingTierId(tier)) {
      return { tier, tierSource: "llm" };
    }
  } catch {
    /* fall through */
  }

  return { tier: "3k", tierSource: "fallback" };
}
