import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { books, vocabulary, dailyArticles } from "@/lib/db/schema";
import { eq, and, lte, desc, count } from "drizzle-orm";
import { isAdmin } from "@/lib/role";
import Link from "next/link";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button-variants";
import { Progress } from "@/components/ui/progress";
import {
  BookOpen,
  BookMarked,
  Library,
  ArrowRight,
  Timer,
  Shield,
  BarChart3,
  Trophy,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DailyStudyChart } from "@/components/dashboard/daily-study-chart";
import { DashboardQuickActions } from "@/components/dashboard/dashboard-quick-actions";
import { MiniReviewPlan } from "@/components/dashboard/mini-review-plan";
import { DashboardDailyArticles } from "@/components/dashboard/dashboard-daily-articles";
import { GuideBanner } from "@/components/dashboard/guide-banner";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { parseArticleLevel } from "@/lib/article-level";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = session.user.id;
  const now = new Date();

  const [dueRows, totalVocabRows, masteredRows, recentBooks, level1Articles, level2Articles, level3Articles] =
    await Promise.all([
      db
        .select({ count: count() })
        .from(vocabulary)
        .where(
          and(
            eq(vocabulary.userId, userId),
            eq(vocabulary.isMastered, false),
            lte(vocabulary.nextReviewAt, now)
          )
        ),
      db
        .select({ count: count() })
        .from(vocabulary)
        .where(eq(vocabulary.userId, userId)),
      db
        .select({ count: count() })
        .from(vocabulary)
        .where(
          and(eq(vocabulary.userId, userId), eq(vocabulary.isMastered, true))
        ),
      db
        .select()
        .from(books)
        .where(eq(books.userId, userId))
        .orderBy(desc(books.lastReadAt), desc(books.createdAt))
        .limit(3),
      // 4 articles per level
      db
        .select({
          id: dailyArticles.id,
          title: dailyArticles.title,
          description: dailyArticles.description,
          coverUrl: dailyArticles.coverUrl,
          wordCount: dailyArticles.wordCount,
          publishedAt: dailyArticles.publishedAt,
          createdAt: dailyArticles.createdAt,
          level: dailyArticles.level,
        })
        .from(dailyArticles)
        .where(eq(dailyArticles.level, 1))
        .orderBy(desc(dailyArticles.publishedAt), desc(dailyArticles.createdAt))
        .limit(4),
      db
        .select({
          id: dailyArticles.id,
          title: dailyArticles.title,
          description: dailyArticles.description,
          coverUrl: dailyArticles.coverUrl,
          wordCount: dailyArticles.wordCount,
          publishedAt: dailyArticles.publishedAt,
          createdAt: dailyArticles.createdAt,
          level: dailyArticles.level,
        })
        .from(dailyArticles)
        .where(eq(dailyArticles.level, 2))
        .orderBy(desc(dailyArticles.publishedAt), desc(dailyArticles.createdAt))
        .limit(4),
      db
        .select({
          id: dailyArticles.id,
          title: dailyArticles.title,
          description: dailyArticles.description,
          coverUrl: dailyArticles.coverUrl,
          wordCount: dailyArticles.wordCount,
          publishedAt: dailyArticles.publishedAt,
          createdAt: dailyArticles.createdAt,
          level: dailyArticles.level,
        })
        .from(dailyArticles)
        .where(eq(dailyArticles.level, 3))
        .orderBy(desc(dailyArticles.publishedAt), desc(dailyArticles.createdAt))
        .limit(4),
    ]);

  const dueCount = dueRows[0]?.count ?? 0;
  const totalVocab = totalVocabRows[0]?.count ?? 0;
  const masteredCount = masteredRows[0]?.count ?? 0;

  const t = await getTranslations("dashboard");
  const ta = await getTranslations("articles");
  const isNewUser = recentBooks.length === 0 && totalVocab === 0;

  const cookieStore = await cookies();
  const defaultLevel = parseArticleLevel(cookieStore.get("article_level")?.value);

  return (
    <div className="max-w-5xl mx-auto">
      {/* ─── Hero ─── */}
      <div className="relative pb-6 mb-6 border-b border-border/40">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {t("greeting", {
                name: session.user.name?.split(" ")[0] ?? "",
              })}
            </h1>
            <p className="text-muted-foreground mt-1.5 text-base">
              {t("motto")}
            </p>
          </div>
          {isAdmin(session.user.role) ? (
            <Link
              href="/admin"
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "shrink-0 self-start"
              )}
            >
              <Shield className="h-4 w-4 mr-2" />
              {t("adminPanel")}
            </Link>
          ) : null}
        </div>
      </div>

      {/* ─── Guide Banner (full width) ─── */}
      <div className="mb-6">
        <GuideBanner isNewUser={isNewUser} />
      </div>

      {/* ─── Due Notice (above bento grid) ─── */}
      {dueCount > 0 ? (
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-amber-50/80 to-amber-100/50 dark:from-amber-950/30 dark:to-amber-950/10 ring-1 ring-amber-200/50 dark:ring-amber-800/30 p-5 mb-6">
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-lg bg-amber-200/50 dark:bg-amber-700/30 flex items-center justify-center shrink-0">
                <Timer className="h-5 w-5 text-amber-700 dark:text-amber-400" />
              </div>
              <div>
                <p className="font-semibold">
                  {t("dueNotice", { count: dueCount })}
                </p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {t("dueHint")}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              <Link
                href="/vocabulary/review"
                className={cn(buttonVariants({ size: "sm" }))}
              >
                {t("startReview")}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      ) : null}

      {/* ─── Bento Grid ─── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
        {/* Left column */}
        <div className="md:col-span-2 space-y-5">
          {/* Quick actions */}
          <DashboardQuickActions />

          {/* Stats row: Vocab + Bookshelf + Leaderboard + Stats entry */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Vocab card */}
            <Link
              href="/vocabulary"
              aria-label={t("vocabAriaLabel", { count: totalVocab })}
              className="block rounded-xl outline-offset-2 group focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="h-full rounded-xl bg-card-vocab/40 dark:bg-card-vocab/20 ring-1 ring-card-vocab-foreground/20 p-4 transition-all duration-300 hover:shadow-lg hover:shadow-card-vocab-foreground/10 hover:bg-card-vocab/60 dark:hover:bg-card-vocab/30 group-focus-visible:ring-2 group-focus-visible:ring-ring">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-card-vocab-foreground">
                    {t("vocabTotal")}
                  </span>
                  <BookMarked className="h-4 w-4 text-card-vocab-foreground/60" />
                </div>
                <p className="text-3xl font-bold text-card-vocab-foreground">
                  {totalVocab}
                </p>
                <p className="text-xs text-card-vocab-foreground/60 mt-1">
                  {t("mastered", { count: masteredCount })}
                </p>
                {totalVocab > 0 ? (
                  <div className="mt-3 h-1 w-full rounded-full bg-card-vocab-foreground/10 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-card-vocab-foreground/40 transition-all"
                      style={{
                        width: `${(masteredCount / totalVocab) * 100}%`,
                      }}
                    />
                  </div>
                ) : null}
              </div>
            </Link>

            {/* Bookshelf card */}
            <Link
              href="/library"
              aria-label={t("bookshelf")}
              className="block rounded-xl outline-offset-2 group focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="h-full rounded-xl bg-card-bookshelf/40 dark:bg-card-bookshelf/20 ring-1 ring-card-bookshelf-foreground/20 p-4 transition-all duration-300 hover:shadow-lg hover:shadow-card-bookshelf-foreground/10 hover:bg-card-bookshelf/60 dark:hover:bg-card-bookshelf/30 group-focus-visible:ring-2 group-focus-visible:ring-ring">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-card-bookshelf-foreground">
                    {t("bookshelf")}
                  </span>
                  <Library className="h-4 w-4 text-card-bookshelf-foreground/60" />
                </div>
                <p className="text-3xl font-bold text-card-bookshelf-foreground">
                  {recentBooks.length}
                </p>
                <p className="text-xs text-card-bookshelf-foreground/60 mt-1">
                  {t("books")}
                </p>
              </div>
            </Link>

            {/* Leaderboard entry */}
            <Link
              href="/leaderboard"
              className="block rounded-xl outline-offset-2 group focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="h-full rounded-xl bg-gradient-to-br from-amber-50/60 to-orange-50/40 dark:from-amber-950/20 dark:to-orange-950/10 ring-1 ring-amber-200/40 dark:ring-amber-800/30 p-4 transition-all duration-300 hover:shadow-lg hover:shadow-amber-200/20 group-focus-visible:ring-2 group-focus-visible:ring-ring">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-amber-700 dark:text-amber-300">
                    {t("leaderboard")}
                  </span>
                  <Trophy className="h-4 w-4 text-amber-500/60" />
                </div>
                <p className="text-xs text-amber-600/70 dark:text-amber-400/70 mt-1">
                  {t("leaderboardDesc")}
                </p>
              </div>
            </Link>

            {/* Study Stats entry */}
            <Link
              href="/dashboard/stats"
              className="block rounded-xl outline-offset-2 group focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="h-full rounded-xl bg-gradient-to-br from-sky-50/60 to-blue-50/40 dark:from-sky-950/20 dark:to-blue-950/10 ring-1 ring-sky-200/40 dark:ring-sky-800/30 p-4 transition-all duration-300 hover:shadow-lg hover:shadow-sky-200/20 group-focus-visible:ring-2 group-focus-visible:ring-ring">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-sky-700 dark:text-sky-300">
                    {t("studyStats")}
                  </span>
                  <BarChart3 className="h-4 w-4 text-sky-500/60" />
                </div>
                <p className="text-xs text-sky-600/70 dark:text-sky-400/70 mt-1">
                  {t("studyStatsDesc")}
                </p>
              </div>
            </Link>
          </div>
        </div>

        {/* Right column: Mini Review Plan */}
        <MiniReviewPlan dueCount={dueCount} />
      </div>

      {/* ─── Daily Study Chart ─── */}
      <Card className="overflow-hidden mb-6 py-0">
        <div className="bg-gradient-to-r from-primary/[0.03] to-transparent px-6 pt-5 pb-3 border-b border-border/40">
          <div className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Timer className="h-4 w-4 text-primary" />
              {t("dailyStudy")}
            </CardTitle>
            <Link
              href="/dashboard/stats"
              className="text-sm text-primary hover:underline font-medium shrink-0"
            >
              {t("viewMore")}
              <ArrowRight className="inline h-3 w-3 ml-0.5" />
            </Link>
          </div>
        </div>
        <CardContent className="px-6 py-5">
          <DailyStudyChart />
        </CardContent>
      </Card>

      {/* ─── 每日文章 (Daily Articles with tabs) ─── */}
      <DashboardDailyArticles
        defaultLevel={defaultLevel}
        level1={level1Articles}
        level2={level2Articles}
        level3={level3Articles}
        viewAllLabel={t("viewAll")}
        emptyLabel={ta("emptyTitle")}
        titleLabel={t("dailyReadSection")}
      />

      {/* ─── Recent Reading ─── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">{t("recentReading")}</h2>
          <Link
            href="/library"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
          >
            {t("viewAll")}
            <ArrowRight className="ml-1 h-3 w-3" />
          </Link>
        </div>

        {recentBooks.length > 0 ? (
          <>
            {/* Mobile: vertical list (up to 3) */}
            <div className="space-y-3 md:hidden">
              {recentBooks.map((book) => (
                <Link
                  key={book.id}
                  href={`/read/${book.id}`}
                  className="block rounded-xl bg-card ring-1 ring-foreground/10 overflow-hidden hover:shadow-md transition-shadow focus-visible:ring-2 focus-visible:ring-ring outline-offset-2"
                >
                  <div className="flex items-center gap-4 p-4">
                    <div className="w-10 h-14 bg-muted rounded overflow-hidden shrink-0 flex items-center justify-center">
                      {book.coverUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={book.coverUrl}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <BookOpen className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate text-sm">{book.title}</p>
                      {book.author ? (
                        <p className="text-xs text-muted-foreground truncate">{book.author}</p>
                      ) : null}
                      <div className="flex items-center gap-2 mt-1.5">
                        <Progress
                          value={book.readingProgress ?? 0}
                          className="h-1.5 flex-1"
                        />
                        <span className="text-[11px] text-muted-foreground shrink-0 tabular-nums">
                          {book.readingProgress ?? 0}%
                        </span>
                      </div>
                    </div>
                    <span
                      className={cn(
                        buttonVariants({ variant: "outline", size: "sm" }),
                        "shrink-0"
                      )}
                    >
                      {t("continueReading")}
                    </span>
                  </div>
                </Link>
              ))}
            </div>

            {/* Desktop: horizontal scroll */}
            <div className="hidden md:flex gap-4 overflow-x-auto pb-2 -mx-1 px-1 snap-x snap-mandatory scrollbar-none">
              {recentBooks.map((book) => (
                <Link
                  key={book.id}
                  href={`/read/${book.id}`}
                  className="group block min-w-[200px] max-w-[240px] flex-shrink-0 snap-start rounded-xl bg-card ring-1 ring-foreground/10 overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-ring outline-offset-2"
                >
                  <div className="aspect-[3/4] bg-muted relative overflow-hidden">
                    {book.coverUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={book.coverUrl}
                        alt=""
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <BookOpen className="h-8 w-8 text-muted-foreground/40" />
                      </div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent h-1/2 pointer-events-none" />
                    <div className="absolute bottom-3 left-3 right-3">
                      <p className="text-sm font-medium text-white truncate drop-shadow-sm">
                        {book.title}
                      </p>
                    </div>
                  </div>
                  <div className="p-3 space-y-2">
                    {book.author ? (
                      <p className="text-xs text-muted-foreground truncate">
                        {book.author}
                      </p>
                    ) : null}
                    <div className="flex items-center gap-2">
                      <Progress
                        value={book.readingProgress ?? 0}
                        className="flex-1 h-1"
                      />
                      <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                        {book.readingProgress ?? 0}%
                      </span>
                    </div>
                    <span
                      className={cn(
                        buttonVariants({ variant: "outline", size: "sm" }),
                        "w-full mt-1"
                      )}
                    >
                      {t("continueReading")}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </>
        ) : (
          <Card className="border-dashed border-2">
            <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
              <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center ring-1 ring-border">
                <Library className="h-8 w-8 text-muted-foreground" />
              </div>
              <div className="max-w-sm">
                <p className="font-medium mb-1">{t("noRecentReading")}</p>
              </div>
              <div className="flex gap-3">
                <Link href="/library/store" className={cn(buttonVariants())}>
                  {t("goToStore")}
                </Link>
                <Link
                  href="/library/upload"
                  className={cn(buttonVariants({ variant: "outline" }))}
                >
                  {t("uploadEpub")}
                </Link>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}