"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { BookOpen } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { DeleteBookButton } from "./delete-book-button";
import { ChangeCoverButton } from "./change-cover-button";

export type LibraryBookCardBook = {
  id: string;
  title: string;
  author: string | null;
  coverUrl: string | null;
  readingProgress: number | null;
  lastReadAt: Date | string | null;
};

export function LibraryBookCard(book: LibraryBookCardBook) {
  const router = useRouter();

  function goRead() {
    router.push(`/read/${book.id}`);
  }

  const lastRead =
    book.lastReadAt != null
      ? formatDistanceToNow(new Date(book.lastReadAt), { addSuffix: true, locale: zhCN })
      : "未开始";

  return (
    <Card
      className="group relative cursor-pointer hover:shadow-md transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background"
      role="link"
      tabIndex={0}
      onClick={goRead}
      onKeyDown={(e) => {
        if ((e.target as HTMLElement).closest("[data-library-book-actions]")) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          goRead();
        }
      }}
      aria-label={`阅读《${book.title}》`}
    >
      <CardContent className="p-4">
        <div className="w-full aspect-[2/3] rounded-md overflow-hidden mb-3 bg-gradient-to-br from-primary/10 to-primary/20 flex items-center justify-center group-hover:opacity-90 transition-opacity">
          {book.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={book.coverUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <BookOpen className="h-12 w-12 text-primary/40" />
          )}
        </div>

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

        <div className="flex items-center justify-between mt-3 gap-2">
          <p className="text-xs text-muted-foreground min-w-0">{lastRead}</p>
          <div
            data-library-book-actions
            className="flex shrink-0"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <ChangeCoverButton bookId={book.id} hasCover={!!book.coverUrl} />
            <DeleteBookButton bookId={book.id} bookTitle={book.title} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
