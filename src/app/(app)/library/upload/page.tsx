import { EpubUpload } from "@/components/library/epub-upload";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

export default function UploadPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/library" className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}>
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">上传电子书</h1>
          <p className="text-sm text-muted-foreground">支持 EPUB 格式，最大 50MB</p>
        </div>
      </div>

      <EpubUpload />
    </div>
  );
}
