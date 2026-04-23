import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { buttonVariants } from "@/components/ui/button-variants";
import { PublicLibraryUploadClient } from "@/components/library/public-library-upload-client";
import { EXTERNAL_EPUB_FIND_URL } from "@/lib/external-epub-find";
import { cn } from "@/lib/utils";
import { getTranslations } from "next-intl/server";

export default async function PublicLibraryUploadPage() {
  const t = await getTranslations("upload");

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
          {t("storeUploadBack")}
        </Link>
        <div>
          <h1 className="text-2xl font-bold">{t("storeUploadTitle")}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("storeUploadDesc")}
          </p>
        </div>
      </div>

      <PublicLibraryUploadClient />

      <p className="text-sm text-muted-foreground max-w-xl text-left">
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
  );
}
