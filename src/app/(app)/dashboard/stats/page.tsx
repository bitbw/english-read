import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { StatsPageClient } from "./stats-page-client";

export default async function StatsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const t = await getTranslations("stats");

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <StatsPageClient title={t("title")} backLabel={t("backDashboard")} />
    </div>
  );
}
