"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, BookOpen, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { toast } from "sonner";
import { clientFetch, CLIENT_FETCH_NETWORK_ERROR } from "@/lib/client-fetch";
import { getTierLabel, type ReadingTierId } from "@/lib/reading-tiers";
import { cn } from "@/lib/utils";

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

export function PublicBookDetailClient({ book }: { book: PublicBookDetailPayload }) {
  const router = useRouter();
  const [starting, setStarting] = useState(false);

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
        toast.info("本书已在你的书架中");
      } else {
        toast.success("已加入书架");
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
          "-ml-2 text-muted-foreground hover:text-foreground"
        )}
      >
        <ArrowLeft className="h-4 w-4 mr-1" />
        返回书库
      </Link>

      <div className="flex flex-col sm:flex-row gap-6 sm:gap-8">
        <div className="mx-auto sm:mx-0 w-full max-w-[200px] sm:max-w-[220px] shrink-0 aspect-[2/3] rounded-lg overflow-hidden bg-gradient-to-br from-primary/10 to-primary/20 flex items-center justify-center">
          {book.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={book.coverUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <BookOpen className="h-16 w-16 text-primary/35" />
          )}
        </div>

        <div className="flex-1 min-w-0 space-y-4">
          <div>
            <h1 className="text-2xl font-bold leading-tight">{book.title}</h1>
            {book.author && (
              <p className="text-muted-foreground mt-2">{book.author}</p>
            )}
          </div>

          <dl className="grid gap-2 text-sm">
            <div className="flex flex-wrap gap-x-2">
              <dt className="text-muted-foreground shrink-0">难度</dt>
              <dd className="font-medium text-primary">{getTierLabel(book.tier)}</dd>
            </div>
            {sizeLabel && (
              <div className="flex flex-wrap gap-x-2">
                <dt className="text-muted-foreground shrink-0">文件大小</dt>
                <dd>{sizeLabel}</dd>
              </div>
            )}
            <div className="flex flex-wrap gap-x-2">
              <dt className="text-muted-foreground shrink-0">入库时间</dt>
              <dd>{book.createdAtLabel}</dd>
            </div>
            {book.uploaderName && (
              <div className="flex flex-wrap gap-x-2">
                <dt className="text-muted-foreground shrink-0">上传者</dt>
                <dd className="truncate">{book.uploaderName}</dd>
              </div>
            )}
          </dl>

          <div className="flex flex-wrap gap-2 pt-2">
            <Button type="button" size="lg" disabled={starting} onClick={() => void startReading()}>
              {starting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : book.shelfBookId ? (
                "继续阅读"
              ) : (
                "开始阅读"
              )}
            </Button>
            <Link href="/library" className={buttonVariants({ variant: "outline", size: "lg" })}>
              我的书架
            </Link>
          </div>

          <p className="text-xs text-muted-foreground">
            开始阅读时会自动将本书加入你的书架，之后在「我的书架」中可随时打开。
          </p>
        </div>
      </div>
    </div>
  );
}
