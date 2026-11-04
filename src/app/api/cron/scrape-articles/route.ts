import { db } from "@/lib/db";
import { dailyArticles } from "@/lib/db/schema";
import {
  decodeHtmlEntities,
  extractArticleContent,
  parsePublishedDate,
} from "@/lib/levelread-scraper";
import { NextResponse } from "next/server";

export const maxDuration = 60;

const LEVELREAD_BASE = "https://levelread.com";
const MAX_ARTICLES_PER_RUN = 10;
const FETCH_DELAY_MS = 500;

function extractMeta(html: string, property: string): string {
  const m1 = html.match(new RegExp(`property="${property}"\\s+content="([^"]*)"`, "i"));
  const m2 = html.match(new RegExp(`content="([^"]*)"\\s+property="${property}"`, "i"));
  return decodeHtmlEntities(m1?.[1] ?? m2?.[1] ?? "");
}

function parseWordCount(html: string): number | null {
  const m = html.match(/(\d+)\s+words/i);
  return m ? parseInt(m[1], 10) : null;
}

async function fetchArticleSlugs(level: number): Promise<string[]> {
  const url = `${LEVELREAD_BASE}/news/level-${level}`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; EnglishReadBot/1.0)" },
      cache: "no-store",
    });
    if (!res.ok) return [];
    const html = await res.text();
    const slugSet = new Set<string>();
    const regex = new RegExp(`href="\/news\/level-${level}\/([^"/]+)"`, "g");
    let m: RegExpExecArray | null;
    while ((m = regex.exec(html)) !== null) {
      slugSet.add(m[1]);
    }
    return Array.from(slugSet);
  } catch {
    return [];
  }
}

async function scrapeArticle(slug: string, level: number) {
  const sourceUrl = `${LEVELREAD_BASE}/news/level-${level}/${slug}`;
  try {
    const res = await fetch(sourceUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; EnglishReadBot/1.0)" },
      cache: "no-store",
    });
    if (!res.ok) {
      console.log(`[SCRAPE] ${slug}: HTTP ${res.status} ${res.statusText}`);
      return null;
    }
    const html = await res.text();

    const rawTitle = extractMeta(html, "og:title");
    const title = rawTitle.replace(/\s*\|\s*Level Read.*$/i, "").trim();
    const description = extractMeta(html, "og:description");
    const coverUrl = extractMeta(html, "og:image");
    const content = extractArticleContent(html);
    const wordCount = parseWordCount(html);
    const publishedAt = parsePublishedDate(html);

    if (!title || !content) {
      console.log(`[SCRAPE] ${slug}: missing title="${title}" content_len=${content.length}`);
      return null;
    }

    console.log(`[SCRAPE] ${slug}: OK title="${title.substring(0, 40)}" content=${content.length}chars`);

    return {
      title,
      description: description || null,
      coverUrl: coverUrl || null,
      content,
      wordCount,
      publishedAt,
      sourceUrl,
    };
  } catch (e) {
    console.log(`[SCRAPE] ${slug}: exception`, e instanceof Error ? e.message : e);
    return null;
  }
}

// GET /api/cron/scrape-articles
// Vercel cron 自动携带 Authorization: Bearer <CRON_SECRET>
// 本地不设置 CRON_SECRET 时跳过校验
export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const LEVELS = [1, 2, 3];
  let scraped = 0;
  let errors = 0;
  let total = 0;

  for (const level of LEVELS) {
    const slugs = await fetchArticleSlugs(level);
    const limited = slugs.slice(0, MAX_ARTICLES_PER_RUN);

    for (const slug of limited) {
      total++;
      const data = await scrapeArticle(slug, level);
      if (!data) {
        errors++;
      } else {
        try {
          await db
            .insert(dailyArticles)
            .values({ slug, level, ...data })
            .onConflictDoNothing();
          scraped++;
        } catch {
          errors++;
        }
      }
      await new Promise((r) => setTimeout(r, FETCH_DELAY_MS));
    }
  }

  return NextResponse.json({ scraped, errors, total });
}
