import { describe, expect, test } from "vitest";
import { extractReadableContext } from "../extract-readable-context";

const MAX = 500;

describe("extractReadableContext", () => {
  describe("short text (within maxLen)", () => {
    test("returns full text when shorter than maxLen", () => {
      const text = "The cat sat on the mat.";
      const result = extractReadableContext(text, 4, 7, MAX);
      expect(result).toBe(text);
    });

    test("returns full text when equal to maxLen", () => {
      const text = "a".repeat(MAX);
      const result = extractReadableContext(text, 0, 1, MAX);
      expect(result).toBe(text);
    });

    test("trims whitespace and returns full text", () => {
      const text = "  Hello world.  ";
      const result = extractReadableContext(text, 2, 7, MAX);
      expect(result).toBe("Hello world.");
    });
  });

  describe("sentence extraction (text > maxLen, multi-sentence)", () => {
    // Total > 500 chars, so function must extract just the target sentence
    const longText =
      "This is the first introductory sentence that provides some background context. " +
      "Machine learning algorithms can analyze vast amounts of data to identify patterns " +
      "and make predictions with remarkable accuracy. " +
      "This is another unrelated sentence that talks about something else entirely. " +
      "The quick brown fox jumps over the lazy dog near the bank of the river. " +
      "Artificial intelligence has made remarkable progress in recent years. " +
      "Many experts believe that we are still decades away from achieving human-level " +
      "intelligence that can match the flexibility and creativity of the human mind. " +
      "Deep learning takes it even further with neural networks. " +
      "Here is yet another sentence to make the text even longer. " +
      "The end of this long paragraph is finally approaching. " +
      "One final sentence to ensure the total exceeds five hundred characters.";
    // Sanity check
    expect(longText.length).toBeGreaterThan(MAX);

    test("extracts sentence from start of target sentence", () => {
      const wordStart = longText.indexOf("Machine learning algorithms");
      const wordEnd = wordStart + "Machine learning".length;
      const result = extractReadableContext(longText, wordStart, wordEnd, MAX);
      expect(result).toBe(
        "Machine learning algorithms can analyze vast amounts of data to identify patterns " +
        "and make predictions with remarkable accuracy."
      );
      expect(result.length).toBeLessThanOrEqual(MAX);
    });

    test("extracts sentence when word is in the middle", () => {
      const wordStart = longText.indexOf("patterns");
      const wordEnd = wordStart + "patterns".length;
      const result = extractReadableContext(longText, wordStart, wordEnd, MAX);
      expect(result).toContain("patterns");
      expect(result).toBe(
        "Machine learning algorithms can analyze vast amounts of data to identify patterns " +
        "and make predictions with remarkable accuracy."
      );
    });

    test("extracts first sentence when word is in first sentence", () => {
      const wordStart = longText.indexOf("introductory");
      const wordEnd = wordStart + "introductory".length;
      const result = extractReadableContext(longText, wordStart, wordEnd, MAX);
      expect(result).toBe(
        "This is the first introductory sentence that provides some background context."
      );
    });

    test("extracts last sentence when word is in last sentence", () => {
      const wordStart = longText.indexOf("five hundred characters");
      const wordEnd = wordStart + "five hundred characters".length;
      const result = extractReadableContext(longText, wordStart, wordEnd, MAX);
      expect(result).toBe(
        "One final sentence to ensure the total exceeds five hundred characters."
      );
    });

    test("handles word at sentence-final punctuation boundary", () => {
      const contextStart = longText.indexOf("accuracy");
      const wordEnd = contextStart + "accuracy".length;
      const result = extractReadableContext(longText, contextStart, wordEnd, MAX);
      expect(result).toBe(
        "Machine learning algorithms can analyze vast amounts of data to identify patterns " +
        "and make predictions with remarkable accuracy."
      );
    });
  });

  describe("long single sentence exceeding maxLen", () => {
    const longSentence =
      "Neural radiance fields commonly known as NeRF have emerged as a groundbreaking " +
      "paradigm for novel view synthesis achieving photorealistic renderings of complex " +
      "three-dimensional scenes from sparse input images by learning a continuous volumetric " +
      "representation that maps spatial coordinates and viewing directions to color and density " +
      "values using a deep multilayer perceptron which enables the generation of highly detailed " +
      "and view consistent novel views that were previously only possible with extensive manual " +
      "modeling or large numbers of input photographs making it a revolutionary approach in " +
      "computer vision with broad applications in virtual reality augmented reality and digital " +
      "heritage preservation before the advent of this technology such results required " +
      "expensive specialized equipment and significant manual effort from skilled artists.";
    expect(longSentence.length).toBeGreaterThan(MAX);

    test("result never exceeds maxLen", () => {
      const wordStart = longSentence.indexOf("multilayer perceptron");
      const wordEnd = wordStart + "multilayer perceptron".length;
      const result = extractReadableContext(longSentence, wordStart, wordEnd, 500);
      expect(result.length).toBeLessThanOrEqual(500);
    });

    test("selected word is always included in result", () => {
      const word = "multilayer perceptron";
      const wordStart = longSentence.indexOf(word);
      const wordEnd = wordStart + word.length;
      const result = extractReadableContext(longSentence, wordStart, wordEnd, 500);
      expect(result.toLowerCase()).toContain("multilayer perceptron");
    });

    test("result aligns to word boundaries (no leading/trailing spaces)", () => {
      const wordStart = longSentence.indexOf("multilayer perceptron");
      const wordEnd = wordStart + "multilayer perceptron".length;
      const result = extractReadableContext(longSentence, wordStart, wordEnd, 500);
      expect(result).not.toMatch(/^\s/);
      expect(result).not.toMatch(/\s$/);
    });

    test("word near start gets window from beginning", () => {
      const wordStart = longSentence.indexOf("NeRF");
      const wordEnd = wordStart + "NeRF".length;
      const result = extractReadableContext(longSentence, wordStart, wordEnd, 500);
      expect(result.length).toBeLessThanOrEqual(500);
      expect(result).toContain("NeRF");
    });

    test("word near end gets window to end", () => {
      const wordStart = longSentence.indexOf("digital heritage");
      const wordEnd = wordStart + "digital heritage".length;
      const result = extractReadableContext(longSentence, wordStart, wordEnd, 500);
      expect(result.length).toBeLessThanOrEqual(500);
      expect(result).toContain("digital heritage");
    });
  });

  describe("boundary positions with maxLen < text length", () => {
    test("word at very beginning of text", () => {
      const text = "Hello world. How are you doing today? I hope everything is fine.";
      // text is 75 chars, maxLen=50 forces sentence extraction
      const result = extractReadableContext(text, 0, 5, 50);
      expect(result).toBe("Hello world.");
    });

    test("word at end of text in last sentence", () => {
      const text = "Hello world. How are you doing today? I hope everything is fine.";
      const youStart = text.indexOf("everything");
      const result = extractReadableContext(text, youStart, youStart + "everything".length, 50);
      expect(result).toBe("I hope everything is fine.");
    });
  });

  describe("punctuation as sentence boundaries with maxLen < text length", () => {
    test("question mark as sentence boundary", () => {
      // 58 chars total, maxLen=40 forces extraction of the first sentence "What is machine learning?" (29 chars)
      const text = "What is machine learning? It is a powerful tool for data analysis.";
      const wordStart = text.indexOf("machine learning");
      const result = extractReadableContext(text, wordStart, wordStart + "machine learning".length, 40);
      expect(result).toBe("What is machine learning?");
    });

    test("exclamation mark as sentence boundary", () => {
      // 66 chars total, maxLen=40 forces extraction
      const text = "Wow! Machine learning is amazing. It really works for predictions.";
      const wordStart = text.indexOf("Machine learning");
      const result = extractReadableContext(text, wordStart, wordStart + "Machine learning".length, 40);
      expect(result).toBe("Machine learning is amazing.");
    });
  });

  describe("edge cases", () => {
    test("empty text returns empty string", () => {
      const result = extractReadableContext("", 0, 0, MAX);
      expect(result).toBe("");
    });

    test("single word text returns that word", () => {
      const result = extractReadableContext("Hello", 0, 5, MAX);
      expect(result).toBe("Hello");
    });

    test("only whitespace returns empty", () => {
      const result = extractReadableContext("   ", 0, 3, MAX);
      expect(result).toBe("");
    });
  });

  describe("VOCAB_CONTEXT_MAX_LENGTH (500) realistic scenarios", () => {
    test("multi-sentence paragraph: target sentence under 500 returned completely", () => {
      const para =
        "Climate change is one of the most pressing challenges facing humanity today. " +
        "Scientists have warned that global temperatures could rise by more than " +
        "two degrees Celsius by the end of the century if immediate action is not taken. " +
        "This would lead to catastrophic consequences including extreme weather events, " +
        "rising sea levels, and widespread biodiversity loss. " +
        "Governments around the world are now working to implement policies that " +
        "reduce carbon emissions and promote sustainable development. " +
        "The transition to renewable energy sources such as solar and wind power " +
        "has accelerated in recent years across many countries and regions.";
      // para total must exceed 500 to force sentence extraction
      expect(para.length).toBeGreaterThan(500);
      const wordStart = para.indexOf("catastrophic consequences");
      const wordEnd = wordStart + "catastrophic consequences".length;
      const result = extractReadableContext(para, wordStart, wordEnd, MAX);
      expect(result).toContain("catastrophic consequences");
      expect(result.length).toBeLessThanOrEqual(MAX);
      // Should be just the one sentence, not the intro sentence
      expect(result).not.toContain("Climate change is one of the");
    });

    test("short single sentence under 500 returned completely", () => {
      const sentence =
        "The researchers discovered a novel mechanism by which the protein interacts with cellular membranes.";
      expect(sentence.length).toBeLessThan(500);
      const wordStart = sentence.indexOf("protein");
      const result = extractReadableContext(sentence, wordStart, wordStart + 7, MAX);
      expect(result).toBe(sentence);
    });

    test("text barely over maxLen still extracts sentence correctly", () => {
      const text =
        "A short intro. " +
        "The target sentence contains the word photosynthesis which is what we are looking " +
        "for in this particular test case that we have written. This is another sentence.";
      // text total ~168 chars, manually set maxLen=120 to force extraction
      const wordStart = text.indexOf("photosynthesis");
      const result = extractReadableContext(text, wordStart, wordStart + "photosynthesis".length, 120);
      expect(result).toContain("photosynthesis");
      expect(result.length).toBeLessThanOrEqual(120);
      expect(result).not.toContain("A short intro");
    });
  });
});