import { db } from "@/lib/db";
import { dailyArticles, users } from "@/lib/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { BackButton } from "@/components/back-button";
import { auth } from "@/lib/auth";
import { ArticleCard } from "@/components/articles/article-card";
import { ArticleLevelTabs } from "@/components/articles/article-level-tabs";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Newspaper } from "lucide-react";
import { getTranslations } from "next-intl/server";

const PAGE_SIZE = 12;

const levelTabs = [
  { level: 1, label: "level1" },
  { level: 2, label: "level2" },
  { level: 3, label: "level3" },
];

export default async function ArticlesPage({
  searchParams,
}: {
  searchParams: Promise<{ level?: string; page?: string }>;
}) {
  const session = await auth();

  const t = await getTranslations("articles");
  const translatedLevelTabs = levelTabs.map((lt) => ({
    ...lt,
    label: t(lt.label),
  }));

  const sp = await searchParams;
  let level: number;
  if (sp.level) {
    level = Math.max(1, Math.min(3, parseInt(sp.level, 10)));
  } else if (session?.user?.id) {
    const [userRow] = await db
      .select({ articleLevel: users.articleLevel })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);
    level = userRow?.articleLevel ?? 1;
  } else {
    level = 1;
  }
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
      .orderBy(
        sql`${dailyArticles.publishedAt} DESC NULLS LAST`,
        desc(dailyArticles.createdAt),
      )
      .limit(PAGE_SIZE)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(dailyArticles)
      .where(where),
  ]);

  const total = countResult[0]?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const paginationPages = [...new Set([1, page - 1, page, page + 1, totalPages])]
    .filter((pageNumber) => pageNumber > 0 && pageNumber <= totalPages)
    .sort((a, b) => a - b);

  return (
    <div className="max-w-6xl mx-auto flex flex-col gap-6 pb-20 md:pb-0">
      {/* Header */}
      <div className="flex items-center gap-3">
        <BackButton fallbackHref="/dashboard" />
        <Newspaper className="h-6 w-6 text-primary shrink-0" />
        <div>
          <h1 className="text-xl font-bold leading-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
      </div>

      {/* Level tabs */}
      <ArticleLevelTabs levelTabs={translatedLevelTabs} currentLevel={level} />

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
        <div className="flex flex-col items-center gap-2 pt-2">
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  href={page > 1 ? `/articles?level=${level}&page=${page - 1}` : undefined}
                  aria-label={t("prevPage")}
                >
                  {t("prevPage")}
                </PaginationPrevious>
              </PaginationItem>
              {paginationPages.map((pageNumber, index) => (
                <PaginationItem key={pageNumber}>
                  {index > 0 && pageNumber - paginationPages[index - 1] > 1 ? (
                    <PaginationEllipsis />
                  ) : null}
                  <PaginationLink
                    href={`/articles?level=${level}&page=${pageNumber}`}
                    isActive={pageNumber === page}
                    aria-label={t("pageIndicator", { page: pageNumber, total: totalPages })}
                  >
                    {pageNumber}
                  </PaginationLink>
                </PaginationItem>
              ))}
              <PaginationItem>
                <PaginationNext
                  href={page < totalPages ? `/articles?level=${level}&page=${page + 1}` : undefined}
                  aria-label={t("nextPage")}
                >
                  {t("nextPage")}
                </PaginationNext>
              </PaginationItem>
            </PaginationContent>
          </Pagination>
          <span className="text-sm text-muted-foreground">
            {t("pageIndicator", { page, total: totalPages })}
          </span>
        </div>
      )}
    </div>
  );
}
