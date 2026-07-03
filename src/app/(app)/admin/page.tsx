import Link from "next/link";
import { AdminUsersClient } from "./admin-users-client";
import { requireAdminSession } from "@/lib/require-admin";
import { getLocale, getTranslations } from "next-intl/server";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Code2 } from "lucide-react";

export default async function AdminPage() {
  await requireAdminSession();
  const t = await getTranslations("admin");
  const locale = await getLocale();

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <Link href="/dev" className="group block">
        <Card className="transition-all duration-200 hover:border-primary/30 hover:shadow-md hover:-translate-y-0.5">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2 ring-1 ring-foreground/5">
                <Code2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>开发工具</CardTitle>
                <CardDescription>
                  clientFetch 调试、Similar Words API、Sentry 上报测试、文章爬取
                </CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>
      </Link>

      <AdminUsersClient
        title={t("title")}
        backLabel={t("backDashboard")}
        locale={locale}
      />
    </div>
  );
}
