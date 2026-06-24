import Link from "next/link";
import { buttonVariants } from "@/components/ui/button-variants";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  BarChart3,
  BookMarked,
  BookOpen,
  GraduationCap,
  Library,
  Trophy,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getTranslations } from "next-intl/server";
import { LandingHeader } from "@/components/landing/landing-header";
import { LandingShowcaseImage } from "@/components/landing/landing-showcase-image";

export default async function LandingPage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  const t = await getTranslations("landing");

  const features = [
    { icon: BookOpen, title: t("feature1Title"), desc: t("feature1Desc") },
    { icon: BookMarked, title: t("feature2Title"), desc: t("feature2Desc") },
    { icon: GraduationCap, title: t("feature3Title"), desc: t("feature3Desc") },
    { icon: BarChart3, title: t("feature4Title"), desc: t("feature4Desc") },
    { icon: Trophy, title: t("feature5Title"), desc: t("feature5Desc") },
    { icon: Library, title: t("feature6Title"), desc: t("feature6Desc") },
  ];

  const srsStages = [
    { stage: t("srsNew"), days: t("day1") },
    { stage: t("srs1"), days: t("day2") },
    { stage: t("srs2"), days: t("day4") },
    { stage: t("srs3"), days: t("day7") },
    { stage: t("srs4"), days: t("day15") },
    { stage: t("srs5"), days: t("day30") },
  ];

  const showcases = [
    {
      title: t("showcaseReadingTitle"),
      desc: t("showcaseReadingDesc"),
      image: "/landing/reading.png",
      alt: t("altReading"),
      priority: true,
    },
    {
      title: t("showcaseVocabTitle"),
      desc: t("showcaseVocabDesc"),
      image: "/landing/vocabulary.png",
      alt: t("altVocabulary"),
      reverse: true,
    },
    {
      title: t("showcaseReviewTitle"),
      desc: t("showcaseReviewDesc"),
      image: "/landing/review.png",
      alt: t("altReview"),
    },
    {
      title: t("showcaseStatsTitle"),
      desc: t("showcaseStatsDesc"),
      image: "/landing/stats.png",
      alt: t("altStats"),
      reverse: true,
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <LandingHeader loginLabel={t("login")} />

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,oklch(0.92_0_0),transparent)] dark:bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,oklch(0.28_0_0),transparent)]"
        />
        <div className="relative mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 md:grid-cols-2 md:items-center md:py-24">
          <div className="text-center md:text-left">
            <p className="mb-4 inline-flex rounded-full border border-border bg-muted/60 px-3 py-1 text-xs font-medium text-muted-foreground">
              {t("heroBadge")}
            </p>
            <h1 className="text-balance text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
              {t("hero")}
            </h1>
            <p className="mt-4 text-lg text-muted-foreground sm:text-xl">
              {t("heroDesc")}
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3 md:justify-start">
              <Link href="/login" className={cn(buttonVariants({ size: "lg" }))}>
                {t("startFree")}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
              <Link
                href="/login"
                className={cn(buttonVariants({ size: "lg", variant: "outline" }))}
              >
                {t("login")}
              </Link>
            </div>
          </div>
          <LandingShowcaseImage
            src="/landing/reading.png"
            alt={t("altReading")}
            priority
            className="mx-auto w-full max-w-xl md:max-w-none"
          />
        </div>
      </section>

      {/* Feature grid */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="rounded-xl border border-border bg-card p-5 transition-colors hover:bg-muted/30"
            >
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                <Icon className="h-4 w-4 text-primary" />
              </div>
              <h3 className="font-semibold">{title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Showcase sections */}
      <section className="border-y border-border bg-muted/20">
        <div className="mx-auto max-w-6xl space-y-20 px-4 py-16 sm:px-6 md:py-24">
          {showcases.map(({ title, desc, image, alt, reverse, priority }) => (
            <div
              key={title}
              className={cn(
                "grid items-center gap-8 md:grid-cols-2 md:gap-12",
                reverse && "md:[&>*:first-child]:order-2",
              )}
            >
              <div className={cn("space-y-3", reverse ? "md:text-right" : "")}>
                <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
                <p className="text-muted-foreground">{desc}</p>
              </div>
              <LandingShowcaseImage
                src={image}
                alt={alt}
                priority={priority}
              />
            </div>
          ))}

          {/* Leaderboard */}
          <div className="grid items-center gap-8 md:grid-cols-2 md:gap-12 md:[&>*:first-child]:order-2">
            <div className="space-y-3 md:text-right">
              <h2 className="text-2xl font-bold tracking-tight">
                {t("showcaseLeaderboardTitle")}
              </h2>
              <p className="text-muted-foreground">{t("showcaseLeaderboardDesc")}</p>
            </div>
            <LandingShowcaseImage
              src="/landing/leaderboard.png"
              alt={t("altLeaderboard")}
            />
          </div>
        </div>
      </section>

      {/* SRS */}
      <section className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6 md:py-20">
        <h2 className="text-2xl font-bold">{t("srsTitle")}</h2>
        <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">{t("srsDesc")}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-2 sm:gap-3">
          {srsStages.map(({ stage, days }, i) => (
            <div
              key={stage}
              className="flex items-center gap-2"
            >
              <div className="rounded-full border border-border bg-card px-3 py-1.5 text-sm sm:px-4 sm:py-2">
                <span className="font-medium">{stage}</span>
                <span className="ml-2 text-muted-foreground">→ {days}</span>
              </div>
              {i < srsStages.length - 1 ? (
                <ArrowRight className="hidden h-3.5 w-3.5 text-muted-foreground/60 sm:block" />
              ) : null}
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border bg-muted/30">
        <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6">
          <h2 className="text-2xl font-bold">{t("ctaTitle")}</h2>
          <p className="mt-3 text-muted-foreground">{t("ctaDesc")}</p>
          <Link
            href="/login"
            className={cn(buttonVariants({ size: "lg" }), "mt-8 inline-flex")}
          >
            {t("startFree")}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </div>
      </section>

      <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
        <div className="flex items-center justify-center gap-2">
          <BookOpen className="h-4 w-4" />
          <span>English Read</span>
        </div>
      </footer>
    </div>
  );
}
