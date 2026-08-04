import Link from "next/link";
import { buttonVariants } from "@/components/ui/button-variants";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import {
  ArrowRight,
  BookMarked,
  BookOpen,
  CalendarDays,
  GraduationCap,
  Library,
  Sparkles,
  Zap,
  Globe,
  Brain,
  BarChart3,
  Trophy,
  Download,
  Smartphone,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getTranslations } from "next-intl/server";
import { LandingHeader } from "@/components/landing/landing-header";
import { LandingShowcaseImage } from "@/components/landing/landing-showcase-image";
import { DownloadAppGuard } from "@/components/landing/download-app-guard";
import APP_VERSION from "@/lib/version";

const APK_BLOB_BASE = "https://bpjalfnicj8nnzo2.public.blob.vercel-storage.com";

async function DownloadAppSection() {
  const name = `EnglishRead-v${APP_VERSION}-release.apk`;
  const url = `${APK_BLOB_BASE}/apks/${name}`;

  return (
    <section className="relative overflow-hidden border-y border-border bg-muted/20">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute top-1/3 right-1/4 h-72 w-72 rounded-full bg-gradient-to-l from-amber-500/10 to-orange-500/5 blur-3xl" />
      </div>
      <div className="relative mx-auto max-w-4xl px-4 py-14 text-center sm:px-6 sm:py-20 md:py-28">
        <div className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 px-3.5 py-1 text-xs font-medium text-primary mb-4">
          <Smartphone className="h-3.5 w-3.5" />
          Android App
        </div>
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Get the App
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
          Take English Read on the go. Read, learn vocabulary, and review anywhere — right from your Android device.
        </p>
        <div className="mt-10 flex flex-col items-center gap-4">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              buttonVariants({ size: "lg" }),
              "inline-flex gap-2 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg shadow-primary/25 transition-all duration-300 hover:shadow-primary/30 hover:-translate-y-0.5",
            )}
          >
            <Download className="h-4 w-4" />
            Download Latest
          </a>
          <p className="text-xs text-muted-foreground">
            {name}
          </p>
        </div>
      </div>
    </section>
  );
}

export default async function LandingPage() {
  const session = await auth();
  if (session?.user) {
    redirect("/dashboard");
  }

  const hdrs = await headers();
  const userAgent = hdrs.get("user-agent") ?? "";
  console.log("[BOWEN_LOG] User-Agent:", userAgent);

  const isApp = userAgent.includes("EnglishRead-App");
  if (isApp) redirect("/login");

  const t = await getTranslations("landing");

  const features = [
    { icon: BookOpen, title: t("feature1Title"), desc: t("feature1Desc") },
    { icon: BookMarked, title: t("feature2Title"), desc: t("feature2Desc") },
    { icon: GraduationCap, title: t("feature3Title"), desc: t("feature3Desc") },
    { icon: BarChart3, title: t("feature4Title"), desc: t("feature4Desc") },
    { icon: Trophy, title: t("feature5Title"), desc: t("feature5Desc") },
    { icon: Library, title: t("feature6Title"), desc: t("feature6Desc") },
    { icon: CalendarDays, title: t("feature7Title"), desc: t("feature7Desc") },
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
      mobileSrc: "/landing/reading-mobile.png",
      accent: "from-rose-500/10 to-pink-500/5",
    },
    {
      title: t("showcaseDailyReadTitle"),
      desc: t("showcaseDailyReadDesc"),
      image: "/landing/daily-article.png",
      alt: t("altDailyRead"),
      mobileSrc: "/landing/daily-article-mobile.png",
      accent: "from-emerald-500/10 to-teal-500/5",
    },
    {
      title: t("showcaseVocabTitle"),
      desc: t("showcaseVocabDesc"),
      image: "/landing/vocabulary.png",
      alt: t("altVocabulary"),
      reverse: true,
      mobileSrc: "/landing/vocabulary-mobile.png",
      accent: "from-amber-500/10 to-orange-500/5",
    },
    {
      title: t("showcaseReviewTitle"),
      desc: t("showcaseReviewDesc"),
      image: "/landing/review.png",
      alt: t("altReview"),
      mobileSrc: "/landing/review-mobile.png",
      accent: "from-emerald-500/10 to-teal-500/5",
    },
    {
      title: t("showcaseStatsTitle"),
      desc: t("showcaseStatsDesc"),
      image: "/landing/stats.png",
      alt: t("altStats"),
      reverse: true,
      mobileSrc: "/landing/stats-mobile.png",
      accent: "from-sky-500/10 to-blue-500/5",
    },
  ];

  const gradients = [
    "from-rose-500 to-pink-600",
    "from-amber-500 to-orange-600",
    "from-emerald-500 to-teal-600",
  ];

  const accentColors = [
    "from-rose-500 to-pink-600 shadow-rose-500/25",
    "from-amber-500 to-orange-600 shadow-amber-500/25",
    "from-emerald-500 to-teal-600 shadow-emerald-500/25",
    "from-sky-500 to-blue-600 shadow-sky-500/25",
    "from-violet-500 to-purple-600 shadow-violet-500/25",
    "from-cyan-500 to-sky-600 shadow-cyan-500/25",
  ];

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <LandingHeader loginLabel={t("login")} />

      {/* ────────────── HERO ────────────── */}
      <section className="relative overflow-hidden border-b border-border">
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -left-40 h-[600px] w-[600px] rounded-full bg-gradient-to-br from-primary/20 via-primary/10 to-transparent blur-3xl" />
          <div className="absolute -bottom-40 -right-40 h-[500px] w-[500px] rounded-full bg-gradient-to-br from-amber-500/15 via-rose-500/10 to-transparent blur-3xl" />
          <div className="absolute top-1/2 left-1/3 h-[400px] w-[400px] rounded-full bg-gradient-to-br from-sky-500/10 via-cyan-500/10 to-transparent blur-3xl" />
        </div>

        <div className="relative mx-auto grid max-w-6xl gap-8 px-4 py-14 sm:px-6 sm:py-20 md:grid-cols-2 md:items-center md:py-32 md:gap-10">
          <div className="text-center md:text-left">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background/80 px-4 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur-sm mb-5">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              {t("heroBadge")}
            </div>
            <h1 className="text-balance text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl lg:text-6xl bg-gradient-to-br from-foreground via-foreground to-foreground/70 bg-clip-text">
              {t("hero")}
            </h1>
            <p className="mt-4 text-base text-muted-foreground sm:text-xl max-w-lg mx-auto md:mx-0">
              {t("heroDesc")}
            </p>
            <div className="mt-8 flex flex-col sm:flex-row justify-center gap-3 md:justify-start">
              <Link
                href="/login"
                className={cn(
                  buttonVariants({ size: "lg" }),
                  "gap-2 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg shadow-primary/25 transition-all duration-300 hover:shadow-primary/30 hover:-translate-y-0.5"
                )}
              >
                {t("startFree")}
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/login"
                className={cn(buttonVariants({ size: "lg", variant: "outline" }), "gap-2")}
              >
                {t("login")}
              </Link>
              <DownloadAppGuard>
                <Link
                  href="/download"
                  className={cn(buttonVariants({ size: "lg", variant: "outline" }), "gap-2")}
                >
                  <Download className="h-4 w-4" />
                  App
                </Link>
              </DownloadAppGuard>
            </div>

            {/* Stats row - desktop only inside left column */}
            <div className="hidden md:flex md:items-center md:justify-start md:gap-8 mt-8">
              <div className="text-center md:text-left">
                <p className="text-xl font-bold md:text-2xl">6+</p>
                <p className="text-xs text-muted-foreground">{t("statsSrsStages")}</p>
              </div>
              <div className="h-8 w-px bg-border" />
              <div className="text-center md:text-left">
                <p className="text-xl font-bold md:text-2xl">100+</p>
                <p className="text-xs text-muted-foreground">{t("statsPublicBooks")}</p>
              </div>
              <div className="h-8 w-px bg-border" />
              <div className="text-center md:text-left">
                <p className="text-xl font-bold md:text-2xl">AI</p>
                <p className="text-xs text-muted-foreground">{t("statsAiPowered")}</p>
              </div>
            </div>
          </div>
          <div className="relative mx-auto w-full max-w-xl md:max-w-none">
            <div className="absolute inset-0 bg-gradient-to-tr from-primary/20 via-transparent to-amber-500/20 rounded-2xl blur-2xl" />
            <LandingShowcaseImage
              src="/landing/reading.png"
              alt={t("altReading")}
              priority
              className="relative"
            />
          </div>
          {/* Stats row - mobile below image */}
          <div className="grid grid-cols-3 gap-4 md:hidden">
            <div className="text-center">
              <p className="text-xl font-bold">6+</p>
              <p className="text-xs text-muted-foreground">{t("statsSrsStages")}</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold">100+</p>
              <p className="text-xs text-muted-foreground">{t("statsPublicBooks")}</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold">AI</p>
              <p className="text-xs text-muted-foreground">{t("statsAiPowered")}</p>
            </div>
          </div>
        </div>
      </section>

      {/* ────────────── FEATURES ────────────── */}
      <section className="relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_100%_60%_at_50%_40%,oklch(0.92_0.02_240/0.3),transparent)] dark:bg-[radial-gradient(ellipse_100%_60%_at_50%_40%,oklch(0.25_0.05_260/0.15),transparent)]" />
        <div className="relative mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
          <div className="text-center mb-10 sm:mb-12">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              {t("featuresTitle")}
            </h2>
            <p className="mt-3 text-muted-foreground max-w-2xl mx-auto">
              {t("featuresDesc")}
            </p>
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {features.map(({ icon: Icon, title, desc }, i) => (
              <div
                key={title}
                className="group relative rounded-2xl border border-border bg-card/50 p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
              >
                <div
                  aria-hidden
                  className={cn(
                    "pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100 bg-gradient-to-br",
                    accentColors[i % accentColors.length].replace(/shadow-\S+/, "")
                  )}
                  style={{ opacity: 0.06 }}
                />
                <div
                  className={cn(
                    "relative mb-4 flex h-11 w-11 items-center justify-center rounded-xl shadow-lg transition-transform duration-300 group-hover:scale-110 bg-gradient-to-br",
                    accentColors[i % accentColors.length].replace(/shadow-\S+/, "")
                  )}
                >
                  <Icon className="h-5 w-5 text-white" />
                </div>
                <h3 className="relative font-semibold text-lg">{title}</h3>
                <p className="relative mt-1.5 text-sm text-muted-foreground leading-relaxed">
                  {desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ────────────── SHOWCASE ────────────── */}
      <section className="relative overflow-hidden border-y border-border bg-muted/20">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_50%,oklch(0.92_0.02_240/0.2),transparent)] dark:bg-[radial-gradient(ellipse_80%_50%_at_50%_50%,oklch(0.25_0.05_260/0.1),transparent)]" />
        <div className="relative mx-auto max-w-6xl space-y-16 px-4 py-14 sm:px-6 sm:py-20 md:space-y-24 md:py-28">
          {showcases.map(({ title, desc, image, alt, reverse, priority, mobileSrc, accent }, i) => (
            <div
              key={title}
              className={cn(
                "relative grid items-center gap-8 md:grid-cols-2 md:gap-16",
                reverse && "md:[&>*:first-child]:order-2"
              )}
            >
              <div className={cn("space-y-4", reverse ? "md:text-right" : "")}>
                <div className={cn("flex items-center gap-3", reverse ? "md:flex-row-reverse md:justify-end" : "")}>
                  <div className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-xs font-bold text-white shadow-md",
                    gradients[i % gradients.length]
                  )}>
                    0{i + 1}
                  </div>
                  <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                    {title}
                  </h2>
                </div>
                <p className="text-muted-foreground leading-relaxed max-w-lg mx-auto md:mx-0">
                  {desc}
                </p>
              </div>
              <div className={cn(
                "relative mx-auto max-w-xs sm:max-w-sm md:max-w-none rounded-2xl bg-gradient-to-br p-1",
                accent
              )}>
                <LandingShowcaseImage
                  src={image}
                  alt={alt}
                  mobileSrc={mobileSrc}
                  priority={priority}
                  className="border-0 shadow-none ring-0"
                />
              </div>
            </div>
          ))}

          {/* Leaderboard */}
          <div className="relative grid items-center gap-8 md:grid-cols-2 md:gap-16 md:[&>*:first-child]:order-2">
            <div className="space-y-4 md:text-right">
              <div className="flex items-center gap-3 md:flex-row-reverse md:justify-end">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500 to-sky-600 text-xs font-bold text-white shadow-md">
                    06
                  </div>
                  <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                    {t("showcaseLeaderboardTitle")}
                  </h2>
              </div>
              <p className="text-muted-foreground leading-relaxed max-w-lg mx-auto md:mx-0 md:ml-auto">
                {t("showcaseLeaderboardDesc")}
              </p>
            </div>
            <div className="relative mx-auto max-w-xs sm:max-w-sm md:max-w-none rounded-2xl bg-gradient-to-br from-cyan-500/10 to-sky-500/5 p-1">
              <LandingShowcaseImage
                src="/landing/leaderboard.png"
                alt={t("altLeaderboard")}
                mobileSrc="/landing/leaderboard-mobile.png"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ────────────── SRS ────────────── */}
      <section className="relative overflow-hidden border-y border-border bg-muted/20">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute top-1/2 left-1/4 h-80 w-80 rounded-full bg-gradient-to-r from-violet-500/10 to-purple-500/10 blur-3xl" />
        </div>
        <div className="relative mx-auto max-w-4xl px-4 py-14 text-center sm:px-6 sm:py-20 md:py-28">
          <div className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-violet-500/10 to-purple-500/10 border border-violet-200/50 dark:border-violet-800/50 px-3.5 py-1 text-xs font-medium text-violet-700 dark:text-violet-300 mb-4">
            <Brain className="h-3.5 w-3.5" />
            Ebbinghaus Curve
          </div>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            {t("srsTitle")}
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
            {t("srsDesc")}
          </p>
          <div className="mt-10 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-center sm:gap-3">
            {srsStages.map(({ stage, days }, i) => (
              <div key={stage} className="flex items-center gap-2">
                <div
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs sm:px-4 sm:py-2.5 sm:text-sm w-full text-center transition-all duration-200 hover:scale-105 hover:shadow-md",
                    i === 0
                      ? "border-emerald-200 dark:border-emerald-800 bg-gradient-to-r from-emerald-50 to-emerald-100/50 dark:from-emerald-950/40 dark:to-emerald-900/20"
                      : i === srsStages.length - 1
                      ? "border-violet-200 dark:border-violet-800 bg-gradient-to-r from-violet-50 to-violet-100/50 dark:from-violet-950/40 dark:to-violet-900/20"
                      : "border-border bg-card"
                  )}
                >
                  <span
                    className={cn(
                      "font-medium",
                      i === 0 && "text-emerald-700 dark:text-emerald-300",
                      i === srsStages.length - 1 && "text-violet-700 dark:text-violet-300"
                    )}
                  >
                    {stage}
                  </span>
                  <span className="ml-1.5 text-muted-foreground">→ {days}</span>
                </div>
                {i < srsStages.length - 1 ? (
                  <ArrowRight className="hidden h-3.5 w-3.5 text-muted-foreground/40 sm:block shrink-0" />
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ────────────── CTA ────────────── */}
      <section className="relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_50%,oklch(0.92_0.05_240/0.3),transparent)] dark:bg-[radial-gradient(ellipse_80%_50%_at_50%_50%,oklch(0.25_0.05_260/0.15),transparent)]" />
        </div>
        <div className="relative mx-auto max-w-3xl px-4 py-14 text-center sm:px-6 sm:py-20 md:py-28">
          <div className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 px-3.5 py-1 text-xs font-medium text-primary mb-4">
            <Zap className="h-3.5 w-3.5" />
            Get Started
          </div>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            {t("ctaTitle")}
          </h2>
          <p className="mt-3 text-muted-foreground max-w-xl mx-auto">
            {t("ctaDesc")}
          </p>
          <Link
            href="/login"
            className={cn(
              buttonVariants({ size: "lg" }),
              "mt-8 inline-flex gap-2 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg shadow-primary/25 transition-all duration-300 hover:shadow-primary/30 hover:-translate-y-0.5"
            )}
          >
            {t("startFree")}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* ────────────── DOWNLOAD APP ────────────── */}
      <DownloadAppGuard>
        <DownloadAppSection />
      </DownloadAppGuard>

      {/* ────────────── FOOTER ────────────── */}
      <footer className="border-t border-border py-8 text-center sm:py-10">
        <div className="flex items-center justify-center gap-2">
          <Globe className="h-4 w-4 text-primary" />
          <span className="font-semibold">English Read</span>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Read · Learn · Master
        </p>
      </footer>
    </div>
  );
}