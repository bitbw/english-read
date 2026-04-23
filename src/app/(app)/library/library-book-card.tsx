"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { BookOpen } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { zhCN, enUS } from "date-fns/locale";
import { DeleteBookButton } from "./delete-book-button";
import { ChangeCoverButton } from "./change-cover-button";
import { RemoveFromShelfButton } from "./remove-from-shelf-button";
import { useTranslations, useLocale } from "next-intl";

export type LibraryBookCardBook = {
  id: string;
  title: string;
  author: string | null;
  coverUrl: string | null;
  readingProgress: number | null;
  lastReadAt: Date | string | null;
  publicBookId?: string | null;
};

export function LibraryBookCard(book: LibraryBookCardBook) {
  const router = useRouter();
  const t = useTranslations("library");
  const locale = useLocale();
  const dateLocale = locale === "zh" ? zhCN : enUS;

  function goRead() {
    router.push(`/read/${book.id}`);
  }

  const lastRead =
    book.lastReadAt != null
      ? formatDistanceToNow(new Date(book.lastReadAt), { addSuffix: true, locale: dateLocale })
      : t("notStarted");

  const fromPublicLibrary = Boolean(book.publicBookId);

  return (
    <Card
      className="group relative min-w-0 cursor-pointer hover:shadow-md transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background py-0"
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
      aria-label={t("readAriaLabel", { title: book.title })}
    >
      <CardContent className="p-2.5 sm:p-4">
        <div className="w-full aspect-[2/3] rounded-md overflow-hidden mb-2 sm:mb-3 bg-gradient-to-br from-primary/10 to-primary/20 flex items-center justify-center group-hover:opacity-90 transition-opacity">
          {book.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={book.coverUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <BookOpen className="h-8 w-8 sm:h-12 sm:w-12 text-primary/40" />
          )}
        </div>

        <div className="space-y-0.5 sm:space-y-1 min-w-0">
          <p
            className="font-medium text-xs sm:text-sm line-clamp-1 leading-tight min-h-[1.25em]"
            title={book.title}
          >
            {book.title}
          </p>
          {book.author && (
            <p className="text-[11px] sm:text-xs text-muted-foreground line-clamp-1">{book.author}</p>
          )}
        </div>

        <div className="mt-2 sm:mt-3 space-y-1">
          <div className="flex justify-between gap-1 text-[11px] sm:text-xs text-muted-foreground">
            <span className="min-w-0 shrink-0 truncate">{t("readingProgress")}</span>
            <span className="tabular-nums shrink-0">{book.readingProgress ?? 0}%</span>
          </div>
          <Progress value={book.readingProgress ?? 0} className="h-1 sm:h-1.5" />
        </div>

        <div className="mt-2 sm:mt-3 flex items-center justify-between gap-1 sm:gap-2">
          <p className="min-w-0 line-clamp-1 text-[11px] sm:text-xs text-muted-foreground">
            {lastRead}
          </p>
          <div
            data-library-book-actions
            className="flex shrink-0 items-center gap-1"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            {fromPublicLibrary ? (
              <>
                <span className="text-[10px] sm:text-[11px] text-muted-foreground whitespace-nowrap shrink-0" title={t("fromPublicLibTitle")}>
                  {t("fromPublicLib")}
                </span>
                <RemoveFromShelfButton bookId={book.id} bookTitle={book.title} />
              </>
            ) : (
              <>
                <ChangeCoverButton bookId={book.id} hasCover={!!book.coverUrl} />
                <DeleteBookButton bookId={book.id} bookTitle={book.title} />
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
