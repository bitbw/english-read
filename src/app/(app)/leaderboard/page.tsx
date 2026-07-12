import { BackButton } from "@/components/back-button";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { LeaderboardPageClient } from "./leaderboard-page-client";

export default async function LeaderboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const t = await getTranslations("leaderboard");

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <BackButton fallbackHref="/dashboard" />
      </div>
      <LeaderboardPageClient title={t("title")} />
    </div>
  );
}
