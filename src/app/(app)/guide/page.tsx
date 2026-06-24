import { auth } from "@/lib/auth";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowLeft, ArrowRight, BookOpen, GraduationCap, Library, Lightbulb, Timer } from "lucide-react";
import { buttonVariants } from "@/components/ui/button-variants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export default async function GuidePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const t = await getTranslations("guide");

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard"
          className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}
          aria-label={t("backHome")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
      </div>

      <p className="text-sm text-muted-foreground">{t("intro")}</p>

      <Card className="border-primary/30 bg-primary/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-primary" />
            {t("beginnerTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>{t("beginnerBody")}</p>
          <Link
            href="/library/store?tier=2k"
            className={cn(buttonVariants({ variant: "default", size: "sm" }))}
          >
            {t("browse2k")}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Library className="h-4 w-4 text-muted-foreground" />
            {t("step1Title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>{t("step1Body")}</p>
          <div className="flex flex-wrap gap-2">
            <Link href="/library/store" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
              {t("step1LinkStore")}
            </Link>
            <Link href="/library" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
              {t("step1LinkShelf")}
            </Link>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-muted-foreground" />
            {t("step2Title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{t("step2Body")}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <GraduationCap className="h-4 w-4 text-muted-foreground" />
            {t("step3Title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>{t("step3Body")}</p>
          <div className="flex flex-wrap gap-2">
            <Link href="/vocabulary/review" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
              {t("step3LinkReview")}
            </Link>
            <Link href="/vocabulary/plan" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
              {t("step3LinkPlan")}
            </Link>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Timer className="h-4 w-4 text-muted-foreground" />
            {t("step4Title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>{t("step4Body")}</p>
          <Link href="/dashboard/stats" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            {t("step4LinkStats")}
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
