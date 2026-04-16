import Link from "next/link";
import { buttonVariants } from "@/components/ui/button-variants";
import { PublicLibraryClient } from "@/components/library/public-library-client";
import { BookOpen, Upload } from "lucide-react";
import { cn } from "@/lib/utils";

export default function PublicLibraryStorePage() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">书库</h1>
          <p className="text-sm text-muted-foreground mt-1">
            浏览公共电子书，点进书籍查看详情；在详情页「开始阅读」会自动加入书架。需要上传新书请点击「上传到书库」。
          </p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <Link
            href="/library/store/upload"
            className={cn(buttonVariants({ variant: "default" }), "justify-center")}
          >
            <Upload className="h-4 w-4 mr-2" />
            上传到书库
          </Link>
          <Link href="/library" className={cn(buttonVariants({ variant: "outline" }), "justify-center")}>
            <BookOpen className="h-4 w-4 mr-2" />
            我的书架
          </Link>
        </div>
      </div>

      <PublicLibraryClient />
    </div>
  );
}
