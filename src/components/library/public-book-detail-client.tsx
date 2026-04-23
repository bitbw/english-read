"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  HardDrive,
  Layers,
  Library,
  Loader2,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { clientFetch, CLIENT_FETCH_NETWORK_ERROR } from "@/lib/client-fetch";
import type { ReadingTierId } from "@/lib/reading-tiers";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

export type PublicBookDetailPayload = {
  id: string;
  title: string;
  author: string | null;
  coverUrl: string | null;
  tier: ReadingTierId;
  fileSize: number | null;
  createdAtLabel: string;
  uploaderName: string | null;
  /** 已在个人书架中时的 `books.id` */
  shelfBookId: string | null;
};

function formatFileSize(bytes: number | null) {
  if (bytes == null || bytes <= 0) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function MetaRow({
  icon: Icon,
  label,
  children,
  className,
}: {
  icon: LucideIcon;
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex gap-3 min-w-0", className)}>
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted/80 text-muted-foreground">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1 py-0.5">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="text-sm text-foreground mt-0.5 break-words">{children}</p>
      </div>
    </div>
  );
}

export function PublicBookDetailClient({ book }: { book: PublicBookDetailPayload }) {
  const router = useRouter();
  const [starting, setStarting] = useState(false);
  const t = useTranslations("library");

  async function startReading() {
    if (book.shelfBookId) {
      router.push(`/read/${book.shelfBookId}`);
      return;
    }
    setStarting(true);
    try {
      const res = await clientFetch("/api/books/from-public", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicBookId: book.id }),
      });
      if (!res.ok) return;
      const data = (await res.json()) as { bookId: string; alreadyAdded?: boolean };
      if (data.alreadyAdded) {
        toast.info(t("alreadyOnShelf"));
      } else {
        toast.success(t("addedToShelf"));
      }
      router.push(`/read/${data.bookId}`);
    } catch (e) {
      if (e instanceof Error && e.message !== CLIENT_FETCH_NETWORK_ERROR) {
        toast.error(e.message);
      }
    } finally {
      setStarting(false);
    }
  }

  const sizeLabel = formatFileSize(book.fileSize);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Link
        href="/library/store"
        className={cn(
          buttonVariants({ variant: "ghost", size: "sm" }),
          "-ml-2 w-fit text-muted-foreground hover:text-foreground"
        )}
      >
        <ArrowLeft className="h-4 w-4 mr-1" />
        {t("backToStore")}
      </Link>

      <Card className="overflow-hidden py-0 gap-0 shadow-sm ring-1 ring-foreground/10">
        <CardContent className="p-0">
          <div className="grid md:grid-cols-[240px_1fr] lg:grid-cols-[260px_1fr] gap-0">
            {/* 封面：与书架卡片同系渐变 + 书脊阴影 */}
            <div className="relative bg-gradient-to-br from-muted/60 via-muted/30 to-primary/5 p-6 sm:p-8 md:p-10 flex justify-center md:justify-start border-b md:border-b-0 md:border-r border-border/60">
              <div className="relative w-full max-w-[200px] md:max-w-none md:w-full aspect-[2/3] rounded-lg overflow-hidden shadow-lg ring-1 ring-foreground/10 bg-gradient-to-br from-primary/10 to-primary/20">
                {book.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={book.coverUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <BookOpen className="h-16 w-16 text-primary/35" strokeWidth={1.25} />
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col p-6 sm:p-8 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <Badge variant="secondary" className="font-normal gap-1">
                  <Layers className="h-3 w-3 opacity-80" />
                  {t(`readingTier.${book.tier}`)}
                </Badge>
                {book.shelfBookId && (
                  <Badge variant="outline" className="font-normal text-muted-foreground border-border">
                    {t("onShelfBadge")}
                  </Badge>
                )}
              </div>

              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-balance leading-tight">
                {book.title}
              </h1>
              {book.author && (
                <p className="text-muted-foreground mt-2 text-base">{book.author}</p>
              )}

              <Separator className="my-6" />

              <div className="rounded-xl border border-border/80 bg-muted/25 p-4 space-y-4">
                <MetaRow icon={Calendar} label={t("metaDateAdded")}>
                  {book.createdAtLabel}
                </MetaRow>
                {sizeLabel && (
                  <MetaRow icon={HardDrive} label={t("metaFileSize")}>
                    {sizeLabel}
                  </MetaRow>
                )}
                {book.uploaderName && (
                  <MetaRow icon={User} label={t("metaUploader")}>
                    {book.uploaderName}
                  </MetaRow>
                )}
              </div>
            </div>
          </div>
        </CardContent>

        <CardFooter className="flex-col items-stretch gap-4 sm:flex-row sm:items-center sm:justify-between border-t bg-muted/40 px-6 py-5 sm:px-8">
          <p className="text-xs text-muted-foreground text-center sm:text-left order-2 sm:order-1 sm:max-w-md">
            {t("readDesc")}
          </p>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto order-1 sm:order-2 shrink-0">
            <Button
              type="button"
              size="default"
              className="w-full sm:w-auto min-w-[8rem]"
              disabled={starting}
              onClick={() => void startReading()}
            >
              {starting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : book.shelfBookId ? (
                t("continueReading")
              ) : (
                t("startReading")
              )}
            </Button>
            <Link
              href="/library"
              className={cn(
                buttonVariants({ variant: "outline", size: "default" }),
                "w-full sm:w-auto justify-center min-w-[8rem]"
              )}
            >
              <Library className="h-4 w-4 mr-2 opacity-80" />
              {t("myShelf")}
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
