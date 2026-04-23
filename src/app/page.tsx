import Link from "next/link";
import { buttonVariants } from "@/components/ui/button-variants";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { BookOpen, BookMarked, GraduationCap, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { getTranslations } from "next-intl/server";
import { LocaleSwitcher } from "@/components/locale-switcher";

export default async function LandingPage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  const t = await getTranslations("landing");

  const features = [
    { icon: BookOpen, title: t("feature1Title"), desc: t("feature1Desc") },
    { icon: BookMarked, title: t("feature2Title"), desc: t("feature2Desc") },
    { icon: GraduationCap, title: t("feature3Title"), desc: t("feature3Desc") },
  ];

  const srsStages = [
    { stage: t("srsNew"), days: t("day1") },
    { stage: t("srs1"), days: t("day2") },
    { stage: t("srs2"), days: t("day4") },
    { stage: t("srs3"), days: t("day7") },
    { stage: t("srs4"), days: t("day15") },
    { stage: t("srs5"), days: t("day30") },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            <span className="font-bold">English Read</span>
          </div>
          <div className="flex items-center gap-2">
            <LocaleSwitcher />
            <Link href="/login" className={cn(buttonVariants({ size: "sm" }))}>{t("login")}</Link>
          </div>
        </div>
      </header>

      <section className="max-w-5xl mx-auto px-6 py-24 text-center">
        <h1 className="text-5xl font-bold leading-tight">{t("hero")}</h1>
        <p className="mt-4 text-xl text-muted-foreground max-w-2xl mx-auto">
          {t("heroDesc")}
        </p>
        <div className="mt-8 flex justify-center">
          <Link href="/login" className={cn(buttonVariants({ size: "lg" }))}>
            {t("startFree")}<ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-6 pb-24">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {features.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="p-6 rounded-xl border border-border bg-card">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-semibold mb-2">{title}</h3>
              <p className="text-sm text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-muted/30 border-t border-border">
        <div className="max-w-3xl mx-auto px-6 py-16 text-center">
          <h2 className="text-2xl font-bold mb-4">{t("srsTitle")}</h2>
          <p className="text-muted-foreground mb-8">{t("srsDesc")}</p>
          <div className="flex flex-wrap justify-center gap-3">
            {srsStages.map(({ stage, days }) => (
              <div key={stage} className="px-4 py-2 rounded-full bg-background border border-border text-sm">
                <span className="font-medium">{stage}</span>
                <span className="text-muted-foreground ml-2">→ {days}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
