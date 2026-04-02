import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { books, vocabulary, readingDailyTime } from "@/lib/db/schema";
import { utcDayKeys } from "@/lib/reading-time";
import { eq, and, lte, desc, count, gte } from "drizzle-orm";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button-variants";
import { Progress } from "@/components/ui/progress";
import {
  BookOpen,
  BookMarked,
  GraduationCap,
  Library,
  ArrowRight,
  Timer,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DailyStudyChart } from "@/components/dashboard/daily-study-chart";

const CHART_DAYS = 14;

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const userId = session.user.id;
  const now = new Date();

  const [dueResult] = await db
    .select({ count: count() })
    .from(vocabulary)
    .where(and(eq(vocabulary.userId, userId), eq(vocabulary.isMastered, false), lte(vocabulary.nextReviewAt, now)));

  const [totalVocabResult] = await db
    .select({ count: count() })
    .from(vocabulary)
    .where(eq(vocabulary.userId, userId));

  const [masteredResult] = await db
    .select({ count: count() })
    .from(vocabulary)
    .where(and(eq(vocabulary.userId, userId), eq(vocabulary.isMastered, true)));

  const recentBooks = await db
    .select()
    .from(books)
    .where(eq(books.userId, userId))
    .orderBy(desc(books.lastReadAt), desc(books.createdAt))
    .limit(3);

  const dayKeys = utcDayKeys(CHART_DAYS);
  const chartStart = dayKeys[0]!;
  const timeRows = await db
    .select({ day: readingDailyTime.day, seconds: readingDailyTime.seconds })
    .from(readingDailyTime)
    .where(and(eq(readingDailyTime.userId, userId), gte(readingDailyTime.day, chartStart)));
  const timeMap = new Map(timeRows.map((r) => [r.day, r.seconds]));
  const studySeries = dayKeys.map((day) => ({ day, seconds: timeMap.get(day) ?? 0 }));

  const dueCount = dueResult?.count ?? 0;
  const totalVocab = totalVocabResult?.count ?? 0;
  const masteredCount = masteredResult?.count ?? 0;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">你好，{session.user.name?.split(" ")[0]} 👋</h1>
        <p className="text-muted-foreground mt-1">今天也要坚持学习哦</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <GraduationCap className="h-4 w-4" />今日待复习
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-primary">{dueCount}</p>
            <p className="text-xs text-muted-foreground mt-1">个单词</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <BookMarked className="h-4 w-4" />生词本总计
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{totalVocab}</p>
            <p className="text-xs text-muted-foreground mt-1">已掌握 {masteredCount} 个</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <Library className="h-4 w-4" />书架
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{recentBooks.length}</p>
            <p className="text-xs text-muted-foreground mt-1">本书</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Timer className="h-4 w-4 text-muted-foreground" />
            每日学习时长
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DailyStudyChart series={studySeries} />
        </CardContent>
      </Card>

      {dueCount > 0 && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pt-6">
            <div>
              <p className="font-semibold">你有 {dueCount} 个单词等待复习</p>
              <p className="text-sm text-muted-foreground mt-0.5">趁热打铁，现在复习效果最好</p>
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              <Link href="/vocabulary/plan" className={cn(buttonVariants({ variant: "outline" }))}>
                复习计划
              </Link>
              <Link href="/vocabulary/review" className={cn(buttonVariants())}>
                开始复习<ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">最近阅读</h2>
          <Link href="/library" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
            查看全部 <ArrowRight className="ml-1 h-3 w-3" />
          </Link>
        </div>
        {recentBooks.length > 0 ? (
          <div className="space-y-3">
            {recentBooks.map((book) => (
              <Card key={book.id} className="hover:shadow-md transition-shadow">
                <CardContent className="flex items-center gap-4 pt-4 pb-4">
                  <div className="w-10 h-14 bg-muted rounded flex items-center justify-center shrink-0">
                    <BookOpen className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{book.title}</p>
                    {book.author && <p className="text-sm text-muted-foreground truncate">{book.author}</p>}
                    <div className="flex items-center gap-2 mt-1.5">
                      <Progress value={book.readingProgress ?? 0} className="h-1.5 flex-1" />
                      <span className="text-xs text-muted-foreground shrink-0">{book.readingProgress ?? 0}%</span>
                    </div>
                  </div>
                  <Link href={`/read/${book.id}`} className={cn(buttonVariants({ variant: "outline", size: "sm" }), "shrink-0")}>
                    继续阅读
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
              <Library className="h-10 w-10 text-muted-foreground" />
              <p className="text-muted-foreground">还没有书，快去上传一本吧</p>
              <Link href="/library/upload" className={cn(buttonVariants())}>上传 EPUB</Link>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
