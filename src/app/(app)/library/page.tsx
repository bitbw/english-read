import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { books } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button-variants";
import { Card, CardContent } from "@/components/ui/card";
import { BookOpen, Upload } from "lucide-react";
import { LibraryBookCard } from "./library-book-card";
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
            <LibraryBookCard key={book.id} {...book} />
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
