import { EpubUpload } from "@/components/library/epub-upload";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import { getTranslations } from "next-intl/server";

export default async function UploadPage() {
  const t = await getTranslations("upload");

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/library" className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}>
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">{t("pageTitle")}</h1>
          <p className="text-sm text-muted-foreground">{t("pageSubtitle")}</p>
        </div>
      </div>

      <EpubUpload />
    </div>
  );
}
