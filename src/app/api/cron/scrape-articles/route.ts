import { db } from "@/lib/db";
import { dailyArticles } from "@/lib/db/schema";
import { NextResponse } from "next/server";

export const maxDuration = 60;

const LEVELREAD_BASE = "https://levelread.com";
const MAX_ARTICLES_PER_RUN = 10;
const FETCH_DELAY_MS = 500;

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(parseInt(n, 10)));
}

function extractMeta(html: string, property: string): string {
  const m1 = html.match(new RegExp(`property="${property}"\\s+content="([^"]*)"`, "i"));
  const m2 = html.match(new RegExp(`content="([^"]*)"\\s+property="${property}"`, "i"));
  return decodeHtmlEntities(m1?.[1] ?? m2?.[1] ?? "");
}

function extractArticleContent(html: string): string {
  // 在 Audio 章节前截断
  const audioIdx = html.search(/>\s*Audio\s*</i);
  const relevantHtml = audioIdx > 0 ? html.substring(0, audioIdx) : html;

  // 直接定位 space-y-8 容器，找到它后面 > 之后的内容
  const spaceIdx = relevantHtml.indexOf('space-y-8');
  if (spaceIdx === -1) return "";

  // space-y-8 后面找 > 即内容开始
  const contentStart = relevantHtml.indexOf('>', spaceIdx);
  if (contentStart === -1) return "";
  const afterContentDiv = relevantHtml.substring(contentStart + 1);

  // 内容结束后是 </div></div><div class="flex" (flex 工具栏)
  // 用 indexOf 直接查找，避免正则回溯问题
  const endMarkers = [
    '</div></div><div class="flex flex-col gap-y-5',
    '</div></div><div class="flex',
    '</div></div><div class="mt-5',
  ];

  let innerHtml = "";
  let endIdx = -1;
  for (const marker of endMarkers) {
    const idx = afterContentDiv.indexOf(marker);
    if (idx !== -1) { endIdx = idx; innerHtml = afterContentDiv.substring(0, endIdx); break; }
  }

  // Debug: 打印找到的内容区域前 500 字符
  console.log(`[SCRAPE-DEBUG] space-y-8 content (first 500): "${innerHtml.substring(0, 500).replace(/\s+/g, " ")}"`);
  console.log(`[SCRAPE-DEBUG] endIdx=${endIdx}, available=${afterContentDiv.length}chars`);

  if (endIdx === -1) {
    // 备选：取 space-y-8 容器到下一个 mt-8 之间的所有内容
    const altEnd = afterContentDiv.indexOf('mt-8');
    if (altEnd === -1 || altEnd > 10000) return "";
    innerHtml = afterContentDiv.substring(0, altEnd);
    console.log(`[SCRAPE-DEBUG] fallback: using idx of "mt-8" at ${altEnd}, inner=${innerHtml.substring(0, 200)}`);
  }

  // levelread.com 段落结构: <div><div class="">...逐词span...</div></div><div><div class="">...下一段...</div></div>
  // 按 </div></div><div> 边界分割，保留原文段落
  const rawBlocks = innerHtml.split(/<\/div>\s*<\/div>\s*<div[^>]*>/i);

  const paragraphs: string[] = [];

  for (let i = 0; i < rawBlocks.length; i++) {
    let block = rawBlocks[i];
    // 第一块可能以 <div><div 开头，去掉
    if (i === 0) block = block.replace(/^<div[^>]*>/i, "").replace(/^<div[^>]*>/i, "");
    // 去所有标签
    const text = decodeHtmlEntities(
      block
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, "")
        .replace(/&nbsp;/g, " ")
        .replace(/\s+/g, " ")
        .trim()
    );
    if (text.length > 20 && /[a-zA-Z]{3,}/.test(text) && /[.!?]/.test(text)) {
      paragraphs.push(text);
    }
  }

  return paragraphs.slice(0, 15).join("\n\n");
}

function parsePublishedDate(html: string): Date | null {
  const m = html.match(/(\d{4})\/(\d{2})\/(\d{2})/);
  if (!m) return null;
  const d = new Date(`${m[1]}-${m[2]}-${m[3]}`);
  return isNaN(d.getTime()) ? null : d;
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
