"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button-variants";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

const EpubReader = dynamic(
  () => import("@/components/reader/epub-reader").then((m) => m.EpubReader),
  {
    ssr: false,
    loading: () => (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-muted-foreground">加载中...</div>
      </div>
    ),
  }
);

interface ReaderClientProps {
  bookId: string;
  title: string;
  blobUrl: string;
  initialCfi: string | null;
}

export function ReaderClient({ bookId, title, blobUrl, initialCfi }: ReaderClientProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border bg-card shrink-0">
        <Link href="/library" className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "h-7 w-7")}>
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-sm font-medium truncate flex-1">{title}</h1>
      </div>

      <div className="flex-1 overflow-hidden">
        <EpubReader
          bookId={bookId}
          blobUrl={blobUrl}
          initialCfi={initialCfi}
        />
      </div>
    </div>
  );
}
