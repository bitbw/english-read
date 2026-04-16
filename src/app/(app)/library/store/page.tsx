import Link from "next/link";
import { buttonVariants } from "@/components/ui/button-variants";
import { PublicLibraryClient } from "@/components/library/public-library-client";
import { BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";

export default function PublicLibraryStorePage() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">书库</h1>
          <p className="text-sm text-muted-foreground mt-1">
            浏览公共电子书，加入书架后可在「我的书架」中阅读。需要新书时可点击下方的「去下载电子书」到外部站点查找。
          </p>
        </div>
        <Link href="/library" className={cn(buttonVariants({ variant: "outline" }))}>
          <BookOpen className="h-4 w-4 mr-2" />
          我的书架
        </Link>
      </div>

      <PublicLibraryClient />
    </div>
  );
}
