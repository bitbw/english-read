import { AdminUsersClient } from "./admin-users-client";
import { requireAdminSession } from "@/lib/require-admin";
import { getLocale, getTranslations } from "next-intl/server";

export default async function AdminPage() {
  await requireAdminSession();
  const t = await getTranslations("admin");
  const locale = await getLocale();

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <AdminUsersClient
        title={t("title")}
        backLabel={t("backDashboard")}
        locale={locale}
      />
    </div>
  );
}
