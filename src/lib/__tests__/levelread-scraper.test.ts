import { describe, expect, it } from "vitest";
import { extractArticleContent, parsePublishedDate } from "../levelread-scraper";

describe("Level Read article parsing", () => {
  it("extracts paragraphs from the current audio paragraph markup", () => {
    const html = `
      <div class="mt-8">
        <div data-audio-highlight-layer="true"></div>
        <div>
          <div data-audio-paragraph-start="0"><span>An online survey in Taiwan suggests that money worries can affect plans to have children.</span></div>
          <div data-audio-paragraph-start="80"><span>Nearly six in ten respondents wanted at least one million in savings.</span></div>
        </div>
      </div>
      <h3>Audio</h3>
      <div data-audio-paragraph-start="120"><span>This audio text must not be included.</span></div>`;

    expect(extractArticleContent(html)).toBe(
      "An online survey in Taiwan suggests that money worries can affect plans to have children.\n\nNearly six in ten respondents wanted at least one million in savings."
    );
  });

  it("parses the current English publication date format", () => {
    expect(parsePublishedDate("Wednesday, November 4, 2026")?.toISOString()).toBe(
      "2026-11-04T00:00:00.000Z"
    );
    expect(parsePublishedDate("Sunday, February 30, 2026")).toBeNull();
  });
});
