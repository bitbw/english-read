import { describe, expect, it } from "vitest";
import {
  calculateReviewTransition,
  getVocabularyState,
} from "@/lib/srs";

describe("review state transitions", () => {
  it("keeps basic review separate from extra practice and mastery", () => {
    expect(calculateReviewTransition(0, false, "advance", "UTC").nextStage).toBe(1);
    expect(calculateReviewTransition(5, false, "advance", "UTC").nextStage).toBe(6);
    expect(calculateReviewTransition(2, false, "remembered", "UTC").nextStage).toBe(6);
    expect(calculateReviewTransition(6, false, "mastered", "UTC").isMastered).toBe(true);
    expect(calculateReviewTransition(6, false, "forgotten", "UTC").nextStage).toBe(0);
    expect(getVocabularyState(2, false)).toBe("forgotten");
    expect(getVocabularyState(6, false)).toBe("remembered");
    expect(getVocabularyState(6, true)).toBe("mastered");
  });
});
