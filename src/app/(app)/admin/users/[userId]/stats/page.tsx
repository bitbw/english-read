import { StudyStatsPanel } from "@/components/dashboard/study-stats-panel";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { requireAdminSession } from "@/lib/require-admin";
import { eq } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

type PageProps = {
  params: Promise<{ userId: string }>;
};

export default async function AdminUserStatsPage({ params }: PageProps) {
  await requireAdminSession();
  const { userId } = await params;

  const [user] = await db
    .select({ id: users.id, name: users.name, email: users.email, phone: users.phone })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) notFound();

  const t = await getTranslations("admin");

  const subtitleParts = [user.name, user.email ?? user.phone].filter(Boolean);
  const subtitle = subtitleParts.length > 1 ? subtitleParts.join(" · ") : subtitleParts[0] ?? undefined;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <StudyStatsPanel
        title={t("userStatsTitle")}
        backHref="/admin"
        backLabel={t("backAdmin")}
        statsEndpoint={`/api/stats/study?userId=${encodeURIComponent(userId)}`}
        subtitle={subtitle}
      />
    </div>
  );
}
