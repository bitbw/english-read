import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { buttonVariants } from "@/components/ui/button-variants";
import { PublicLibraryUploadClient } from "@/components/library/public-library-upload-client";
import { EXTERNAL_EPUB_FIND_URL } from "@/lib/external-epub-find";
import { cn } from "@/lib/utils";

export default function PublicLibraryUploadPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col gap-2">
        <Link
          href="/library/store"
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "w-fit -ml-2 text-muted-foreground hover:text-foreground"
          )}
        >
          ← 返回书库
        </Link>
        <div>
          <h1 className="text-2xl font-bold">上传到公共书库</h1>
          <p className="text-sm text-muted-foreground mt-1">
            上传后所有用户可见，系统将自动识别书名并分级。完成后会返回书库列表。
          </p>
        </div>
      </div>

      <PublicLibraryUploadClient />

      <p className="text-sm text-muted-foreground max-w-xl text-left">
        还没有 EPUB？可先到外部站点查找。
      </p>
      <div className="flex justify-start">
        <a
          href={EXTERNAL_EPUB_FIND_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(buttonVariants({ variant: "outline" }), "justify-center")}
        >
          <ExternalLink className="h-4 w-4 mr-2 shrink-0" />
          去下载电子书
        </a>
      </div>
    </div>
  );
}
