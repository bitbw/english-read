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
      <LeaderboardPageClient title={t("title")} />
    </div>
  );
}
