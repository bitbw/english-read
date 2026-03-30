import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { books } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { BookOpen, Upload } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { DeleteBookButton } from "./delete-book-button";
import { cn } from "@/lib/utils";

export default async function LibraryPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const userBooks = await db
    .select()
    .from(books)
    .where(eq(books.userId, session.user.id))
    .orderBy(desc(books.lastReadAt), desc(books.createdAt));

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">我的书架</h1>
        <Link href="/library/upload" className={cn(buttonVariants())}>
          <Upload className="h-4 w-4 mr-2" />
          上传 EPUB
        </Link>
      </div>

      {userBooks.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {userBooks.map((book) => (
            <Card key={book.id} className="group hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <Link href={`/read/${book.id}`}>
                  <div className="w-full aspect-[2/3] bg-gradient-to-br from-primary/10 to-primary/20 rounded-md flex items-center justify-center mb-3 cursor-pointer hover:opacity-90 transition-opacity">
                    <BookOpen className="h-12 w-12 text-primary/40" />
                  </div>
                </Link>

                <div className="space-y-1">
                  <p className="font-medium text-sm line-clamp-2 leading-tight">{book.title}</p>
                  {book.author && <p className="text-xs text-muted-foreground">{book.author}</p>}
                </div>

                <div className="mt-3 space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>阅读进度</span>
                    <span>{book.readingProgress ?? 0}%</span>
                  </div>
                  <Progress value={book.readingProgress ?? 0} className="h-1.5" />
                </div>

                <div className="flex items-center justify-between mt-3">
                  <p className="text-xs text-muted-foreground">
                    {book.lastReadAt
                      ? formatDistanceToNow(new Date(book.lastReadAt), { addSuffix: true, locale: zhCN })
                      : "未开始"}
                  </p>
                  <DeleteBookButton bookId={book.id} bookTitle={book.title} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
            <BookOpen className="h-14 w-14 text-muted-foreground" />
            <div>
              <p className="font-medium">书架空空如也</p>
              <p className="text-sm text-muted-foreground mt-1">上传你的第一本 EPUB 电子书，开始阅读</p>
            </div>
            <Link href="/library/upload" className={cn(buttonVariants())}>
              <Upload className="h-4 w-4 mr-2" />
              上传 EPUB
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
