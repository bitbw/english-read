import { db } from "@/lib/db";
import { dailyArticles } from "@/lib/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { ArticleCard } from "@/components/articles/article-card";
import { Newspaper } from "lucide-react";
import { getTranslations } from "next-intl/server";

const PAGE_SIZE = 12;

const levelTabs = [
  { level: 1, key: "level1" },
  { level: 2, key: "level2" },
  { level: 3, key: "level3" },
];

export default async function ArticlesPage({
  searchParams,
}: {
  searchParams: Promise<{ level?: string; page?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const t = await getTranslations("articles");

  const sp = await searchParams;
  const level = Math.max(1, Math.min(3, parseInt(sp.level ?? "1", 10)));
  const page = Math.max(1, parseInt(sp.page ?? "1", 10));
  const offset = (page - 1) * PAGE_SIZE;

  const where = and(eq(dailyArticles.level, level));

  const [articles, countResult] = await Promise.all([
    db
      .select({
        id: dailyArticles.id,
        slug: dailyArticles.slug,
        level: dailyArticles.level,
        title: dailyArticles.title,
        description: dailyArticles.description,
        coverUrl: dailyArticles.coverUrl,
        wordCount: dailyArticles.wordCount,
        publishedAt: dailyArticles.publishedAt,
        createdAt: dailyArticles.createdAt,
      })
      .from(dailyArticles)
      .where(where)
      .orderBy(desc(dailyArticles.publishedAt), desc(dailyArticles.createdAt))
      .limit(PAGE_SIZE)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(dailyArticles)
      .where(where),
  ]);

  const total = countResult[0]?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-6 pb-20 md:pb-0">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Newspaper className="h-6 w-6 text-primary shrink-0" />
        <div>
          <h1 className="text-xl font-bold leading-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
      </div>

      {/* Level tabs */}
      <div className="flex gap-1 rounded-lg bg-muted p-1 w-fit">
        {levelTabs.map(({ level: lv, key }) => (
          <Link
            key={lv}
            href={`/articles?level=${lv}`}
            className={cn(
              "flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              level === lv
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Level {lv}
            <span className="hidden sm:inline text-xs opacity-60">· {t(key)}</span>
          </Link>
        ))}
      </div>

      {/* Article grid */}
      {articles.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
          <Newspaper className="h-10 w-10 text-muted-foreground/40" />
          <p className="font-medium text-muted-foreground">{t("emptyTitle")}</p>
          <p className="text-sm text-muted-foreground/70">
            {t("emptyHint")}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {articles.map((a) => (
            <ArticleCard key={a.id} {...a} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          {page > 1 && (
            <Link
              href={`/articles?level=${level}&page=${page - 1}`}
              className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent transition-colors"
            >
              {t("prevPage")}
            </Link>
          )}
          <span className="text-sm text-muted-foreground">
            {t("pageIndicator", { page, total: totalPages })}
          </span>
          {page < totalPages && (
            <Link
              href={`/articles?level=${level}&page=${page + 1}`}
              className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent transition-colors"
            >
              {t("nextPage")}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
