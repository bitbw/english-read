"use client";

import { BackButton } from "@/components/back-button";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { clientFetch } from "@/lib/client-fetch";
import type { AdminUserSummary } from "@/lib/admin-users-types";

function formatDurationMinutes(seconds: number): string {
  const min = Math.round(seconds / 60);
  return String(min);
}

function formatAbsoluteTime(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

function formatRelativeTime(iso: string, locale: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMin = Math.round(diffMs / 60_000);
  if (diffMin < 1) return locale.startsWith("zh") ? "刚刚" : "just now";
  if (diffMin < 60) {
    return locale.startsWith("zh") ? `${diffMin} 分钟前` : `${diffMin}m ago`;
  }
  const diffHours = Math.round(diffMin / 60);
  if (diffHours < 24) {
    return locale.startsWith("zh") ? `${diffHours} 小时前` : `${diffHours}h ago`;
  }
  const diffDays = Math.round(diffHours / 24);
  if (diffDays < 30) {
    return locale.startsWith("zh") ? `${diffDays} 天前` : `${diffDays}d ago`;
  }
  return formatAbsoluteTime(iso, locale);
}

function userDisplayName(user: AdminUserSummary): string {
  if (user.name?.trim()) return user.name.trim();
  if (user.email) return user.email;
  if (user.phone) return user.phone;
  return user.id.slice(0, 8);
}

function userSecondary(user: AdminUserSummary): string | null {
  if (user.email && user.name) return user.email;
  if (user.phone && (user.name || user.email)) return user.phone;
  return null;
}

type AdminUsersClientProps = {
  title: string;
  backLabel: string;
  locale: string;
};

export function AdminUsersClient({ title, backLabel, locale }: AdminUsersClientProps) {
  const t = useTranslations("admin");
  const router = useRouter();
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const r = await clientFetch("/api/admin/users", { showErrorToast: false });
        if (!r.ok) {
          if (!cancelled) setError(t("loadError"));
          return;
        }
        const json = (await r.json()) as { users: AdminUserSummary[] };
        if (!cancelled) setUsers(json.users);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [t]);

  return (
    <>
      <div className="flex items-center gap-3">
        <BackButton fallbackHref="/dashboard" label={backLabel} />
        <h1 className="text-2xl font-bold flex-1 min-w-0">{title}</h1>
      </div>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      ) : error ? (
        <Card>
          <CardContent className="py-10 text-center text-destructive">{error}</CardContent>
        </Card>
      ) : users.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            {t("empty")}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("colUser")}</TableHead>
                  <TableHead>{t("colFirstLogin")}</TableHead>
                  <TableHead>{t("colLastOnline")}</TableHead>
                  <TableHead className="text-right">{t("colReadingTotal")}</TableHead>
                  <TableHead className="text-right">{t("colReviewTotal")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow
                    key={user.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => router.push(`/admin/users/${user.id}/stats`)}
                  >
                    <TableCell>
                      <div className="font-medium">{userDisplayName(user)}</div>
                      {userSecondary(user) ? (
                        <div className="text-xs text-muted-foreground">{userSecondary(user)}</div>
                      ) : null}
                    </TableCell>
                    <TableCell className="tabular-nums whitespace-nowrap">
                      <span title={formatAbsoluteTime(user.createdAt, locale)}>
                        {formatAbsoluteTime(user.createdAt, locale)}
                      </span>
                    </TableCell>
                    <TableCell className="tabular-nums whitespace-nowrap">
                      {user.lastOnlineAt ? (
                        <span title={formatAbsoluteTime(user.lastOnlineAt, locale)}>
                          {formatRelativeTime(user.lastOnlineAt, locale)}
                        </span>
                      ) : (
                        t("noRecord")
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {t("minutesUnit", { min: formatDurationMinutes(user.totalReadingSeconds) })}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {t("minutesUnit", { min: formatDurationMinutes(user.totalReviewSeconds) })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </>
  );
}
