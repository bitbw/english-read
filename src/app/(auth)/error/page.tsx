import Link from "next/link";
import { buttonVariants } from "@/components/ui/button-variants";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { getTranslations } from "next-intl/server";

export default async function AuthErrorPage() {
  const t = await getTranslations("common");

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="text-center space-y-4">
        <AlertTriangle className="h-12 w-12 text-destructive mx-auto" />
        <h1 className="text-xl font-bold">{t("authError")}</h1>
        <p className="text-muted-foreground text-sm max-w-xs">
          {t("authErrorDesc")}
        </p>
        <Link href="/login" className={cn(buttonVariants())}>{t("retryLogin")}</Link>
      </div>
    </div>
  );
}
