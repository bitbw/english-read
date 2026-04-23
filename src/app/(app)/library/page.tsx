import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { books } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button-variants";
import { Card, CardContent } from "@/components/ui/card";
import { BookOpen, ExternalLink, Upload } from "lucide-react";
import { LibraryBookCard } from "./library-book-card";
import { EXTERNAL_EPUB_FIND_URL } from "@/lib/external-epub-find";
import { cn } from "@/lib/utils";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

export default async function LibraryPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userBooks = await db
    .select()
    .from(books)
    .where(eq(books.userId, session.user.id))
    .orderBy(desc(books.lastReadAt), desc(books.createdAt));

  const t = await getTranslations("library");

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("subtitle")}{" "}
            <Link href="/library/store" className="text-primary underline-offset-4 hover:underline">
              {t("storeLink")}
            </Link>
          </p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <Link href="/library/store" className={cn(buttonVariants({ variant: "outline" }))}>
            {t("publicLibrary")}
          </Link>
          <Link href="/library/upload" className={cn(buttonVariants())}>
            <Upload className="h-4 w-4 mr-2" />
            {t("uploadEpub")}
          </Link>
        </div>
      </div>

      <div className="space-y-2 text-left">
        <p className="text-sm text-muted-foreground max-w-xl">
          {t("noEpubHint")}
        </p>
        <div className="flex justify-start">
          <a
            href={EXTERNAL_EPUB_FIND_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(buttonVariants({ variant: "outline" }), "justify-center")}
          >
            <ExternalLink className="h-4 w-4 mr-2 shrink-0" />
            {t("downloadEbook")}
          </a>
        </div>
      </div>

      {userBooks.length > 0 ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-4">
          {userBooks.map((book) => (
            <LibraryBookCard key={book.id} {...book} />
          ))}
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
            <BookOpen className="h-14 w-14 text-muted-foreground" />
            <div>
              <p className="font-medium">{t("emptyTitle")}</p>
              <p className="text-sm text-muted-foreground mt-1">{t("emptyHint")}</p>
            </div>
            <Link href="/library/upload" className={cn(buttonVariants())}>
              <Upload className="h-4 w-4 mr-2" />
              {t("uploadEpub")}
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
