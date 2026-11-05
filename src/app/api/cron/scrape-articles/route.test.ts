import { afterEach, describe, expect, it, vi } from "vitest";

const { captureException, flush, insert, onConflictDoNothing, values } = vi.hoisted(() => ({
  captureException: vi.fn(),
  flush: vi.fn().mockResolvedValue(true),
  insert: vi.fn(),
  onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
  values: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ db: { insert } }));
vi.mock("@/lib/db/schema", () => ({ dailyArticles: {} }));
vi.mock("@sentry/nextjs", () => ({ captureException, flush }));

import { GET } from "./route";

describe("GET /api/cron/scrape-articles", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("reports two consecutive article-content failures to Sentry once", async () => {
    vi.useFakeTimers();
    values.mockReturnValue({ onConflictDoNothing });
    insert.mockReturnValue({ values });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input);
        if (url.endsWith("/news/level-1")) {
          return new Response(
            '<a href="/news/level-1/article-a">A</a><a href="/news/level-1/article-b">B</a>',
          );
        }
        if (url.includes("/news/level-1/")) {
          return new Response('<meta property="og:title" content="Test | Level Read">');
        }
        return new Response("");
      }),
    );

    const responsePromise = GET(new Request("https://english-read.test/api/cron/scrape-articles"));
    await vi.runAllTimersAsync();
    const response = await responsePromise;

    expect(response.status).toBe(200);
    expect(captureException).toHaveBeenCalledOnce();
    expect(captureException.mock.calls[0][0].message).toBe(
      "Level Read scraper failed to extract consecutive article contents",
    );
    expect(captureException.mock.calls[0][1]).toMatchObject({
      tags: { cron_job: "scrape-articles", failure_type: "article_content" },
      extra: {
        failedArticles: [
          { level: 1, slug: "article-a" },
          { level: 1, slug: "article-b" },
        ],
      },
    });
    expect(flush).toHaveBeenCalledWith(2000);
  });

  it("does not report failures separated by a successfully parsed article", async () => {
    vi.useFakeTimers();
    values.mockReturnValue({ onConflictDoNothing });
    insert.mockReturnValue({ values });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input);
        if (url.endsWith("/news/level-1")) {
          return new Response(
            '<a href="/news/level-1/article-a">A</a><a href="/news/level-1/article-b">B</a><a href="/news/level-1/article-c">C</a>',
          );
        }
        if (url.endsWith("/news/level-1/article-b")) {
          return new Response(
            '<meta property="og:title" content="Test | Level Read"><div data-audio-paragraph-start="0">A complete article paragraph that can be stored in the database.</div>',
          );
        }
        if (url.includes("/news/level-1/")) {
          return new Response('<meta property="og:title" content="Test | Level Read">');
        }
        return new Response("");
      }),
    );

    const responsePromise = GET(new Request("https://english-read.test/api/cron/scrape-articles"));
    await vi.runAllTimersAsync();
    await responsePromise;

    expect(captureException).not.toHaveBeenCalled();
    expect(flush).not.toHaveBeenCalled();
  });
});
