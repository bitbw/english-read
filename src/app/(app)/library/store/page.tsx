import { BackButton } from "@/components/back-button";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button-variants";
import { PublicLibraryClient } from "@/components/library/public-library-client";
import { isReadingTierId } from "@/lib/reading-tiers";
import { BookOpen, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { getTranslations } from "next-intl/server";

type PublicLibraryStorePageProps = {
  searchParams: Promise<{ tier?: string }>;
};

export default async function PublicLibraryStorePage({ searchParams }: PublicLibraryStorePageProps) {
  const t = await getTranslations("library");
  const { tier: tierParam } = await searchParams;
  const initialTier = tierParam && isReadingTierId(tierParam) ? tierParam : "all";

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <BackButton fallbackHref="/dashboard" className="shrink-0" />
        <h1 className="text-2xl font-bold min-w-0 truncate">{t("storeTitle")}</h1>
      </div>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <p className="text-sm text-muted-foreground flex-1">
          {t("storeSubtitle")}
        </p>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/library/store/upload"
            className={cn(buttonVariants({ variant: "default" }), "justify-center")}
          >
            <Upload className="h-4 w-4 mr-2" />
            {t("uploadToStore")}
          </Link>
          <Link href="/library" className={cn(buttonVariants({ variant: "outline" }), "justify-center")}>
            <BookOpen className="h-4 w-4 mr-2" />
            {t("myShelf")}
          </Link>
        </div>
      </div>

      <PublicLibraryClient initialTier={initialTier} />
    </div>
  );
}
