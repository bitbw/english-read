"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BackButton } from "@/components/back-button";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { clientFetch } from "@/lib/client-fetch";
import {
  ALL_LEARNING_TIMEZONES,
  FOLLOW_BROWSER_SELECT_VALUE,
  LEARNING_TIMEZONE_GROUPS,
} from "@/lib/learning-timezones";
import { learningTimeZoneOptionLabel } from "@/lib/timezone-display";
import { ExternalLink, LogOut, Mail } from "lucide-react";

const GITHUB_REPO_URL = "https://github.com/bitbw/english-read";
const FEEDBACK_EMAIL = "mail.bitbw@gmail.com";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { LocaleSwitcher } from "@/components/locale-switcher";

export default function SettingsPage() {
  const router = useRouter();
  const t = useTranslations("settings");
  const { data: session, update } = useSession();
  const [savedTimeZone, setSavedTimeZone] = useState<string | null | undefined>(undefined);
  const [draftTimeZone, setDraftTimeZone] = useState("");
  const [showOnLeaderboard, setShowOnLeaderboard] = useState(false);
  const [savingLeaderboardPref, setSavingLeaderboardPref] = useState(false);
  const [prefsLoading, setPrefsLoading] = useState(true);
  const [savingTz, setSavingTz] = useState(false);
  const [draftDisplayName, setDraftDisplayName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [removingAvatar, setRemovingAvatar] = useState(false);
  const avatarFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraftDisplayName(session?.user?.name ?? "");
  }, [session?.user?.name]);

  const loadPrefs = useCallback(async () => {
    setPrefsLoading(true);
    try {
      const r = await clientFetch("/api/user/preferences", { showErrorToast: false });
      if (!r.ok) return;
      const data = (await r.json()) as { timeZone?: string | null; showOnLeaderboard?: boolean };
      const tz = data.timeZone ?? null;
      setSavedTimeZone(tz);
      setDraftTimeZone(tz ?? "");
      setShowOnLeaderboard(data.showOnLeaderboard ?? true);
    } finally {
      setPrefsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPrefs();
  }, [loadPrefs]);

  const showCustomSelectItem = useMemo(
    () => draftTimeZone.trim() !== "" && !ALL_LEARNING_TIMEZONES.includes(draftTimeZone.trim()),
    [draftTimeZone]
  );

  const selectControlValue = draftTimeZone.trim() === "" ? FOLLOW_BROWSER_SELECT_VALUE : draftTimeZone.trim();

  async function onAvatarFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    setUploadingAvatar(true);
    try {
      const r = await clientFetch("/api/user/avatar", { method: "POST", body: fd });
      if (!r.ok) return;
      const data = (await r.json()) as { image?: string };
      await update({ image: data.image });
      router.refresh();
      toast.success(t("avatarUpdated"));
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function removeAvatar() {
    setRemovingAvatar(true);
    try {
      const r = await clientFetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: null }),
      });
      if (!r.ok) return;
      const cleared = (await r.json()) as { image?: string | null };
      await update({ image: cleared.image ?? null });
      router.refresh();
      toast.success(t("avatarRemoved"));
    } finally {
      setRemovingAvatar(false);
    }
  }

  async function saveDisplayName() {
    setSavingName(true);
    try {
      const trimmed = draftDisplayName.trim();
      const body = { name: trimmed === "" ? null : trimmed };
      const r = await clientFetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) return;
      const saved = (await r.json()) as { name?: string | null; image?: string | null };
      await update({ name: saved.name, image: saved.image });
      router.refresh();
      toast.success(trimmed === "" ? t("displayNameCleared") : t("displayNameSaved"));
    } finally {
      setSavingName(false);
    }
  }

  async function toggleShowOnLeaderboard(next: boolean) {
    setSavingLeaderboardPref(true);
    try {
      const r = await clientFetch("/api/user/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ showOnLeaderboard: next }),
      });
      if (!r.ok) return;
      const data = (await r.json()) as { showOnLeaderboard?: boolean };
      setShowOnLeaderboard(data.showOnLeaderboard ?? next);
      toast.success(next ? t("showOnLeaderboardEnabled") : t("showOnLeaderboardDisabled"));
    } finally {
      setSavingLeaderboardPref(false);
    }
  }

  async function saveTimeZone() {
    setSavingTz(true);
    try {
      const trimmed = draftTimeZone.trim();
      const body = { timeZone: trimmed === "" ? null : trimmed };
      const r = await clientFetch("/api/user/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) return;
      const data = (await r.json()) as { timeZone?: string | null };
      setSavedTimeZone(data.timeZone ?? null);
      setDraftTimeZone(data.timeZone ?? "");
      toast.success(trimmed === "" ? t("timezoneFollowBrowser") : t("timezoneSaved"));
    } finally {
      setSavingTz(false);
    }
  }

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <BackButton fallbackHref="/dashboard" />
        <h1 className="text-2xl font-bold">{t("title")}</h1>
      </div>

      {/* 账户信息 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("accountInfo")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <Avatar className="h-16 w-16 shrink-0">
              <AvatarImage src={session?.user?.image ?? ""} />
              <AvatarFallback className="text-lg">
                {(
                  session?.user?.name?.[0] ??
                  session?.user?.email?.[0] ??
                  session?.user?.phone?.[0] ??
                  "U"
                ).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1 space-y-3">
              <div>
                <p className="font-medium truncate">
                  {session?.user?.name?.trim() ? session.user.name : t("noDisplayName")}
                </p>
                <p className="text-sm text-muted-foreground truncate">
                  {session?.user?.email ?? session?.user?.phone ?? ""}
                </p>
              </div>
              <input
                ref={avatarFileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                aria-label={t("selectAvatarAriaLabel")}
                onChange={onAvatarFileChange}
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={uploadingAvatar || removingAvatar}
                  onClick={() => avatarFileInputRef.current?.click()}
                >
                  {uploadingAvatar ? t("uploading") : t("uploadAvatar")}
                </Button>
                {session?.user?.image ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground"
                    disabled={uploadingAvatar || removingAvatar}
                    onClick={() => void removeAvatar()}
                  >
                    {removingAvatar ? t("processing") : t("removeAvatar")}
                  </Button>
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground">
                {t("avatarHint")}
              </p>
            </div>
          </div>
          <div className="space-y-2">
            <label htmlFor="settings-display-name" className="text-sm font-medium">
              {t("displayName")}
            </label>
            <Input
              id="settings-display-name"
              placeholder={t("displayNamePlaceholder")}
              value={draftDisplayName}
              onChange={(e) => setDraftDisplayName(e.target.value)}
              maxLength={80}
              className="max-w-lg"
              autoComplete="nickname"
            />
            <p className="text-xs text-muted-foreground">
              {t("displayNameHint")}
            </p>
            <Button type="button" onClick={() => void saveDisplayName()} disabled={savingName}>
              {savingName ? t("savingName") : t("saveDisplayName")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 排行榜 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("leaderboardPrefs")}</CardTitle>
        </CardHeader>
        <CardContent>
          {prefsLoading ? (
            <p className="text-sm text-muted-foreground">{t("loadingPrefs")}</p>
          ) : (
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 shrink-0 accent-primary"
                checked={showOnLeaderboard}
                disabled={savingLeaderboardPref}
                onChange={(e) => void toggleShowOnLeaderboard(e.target.checked)}
              />
              <span className="space-y-1">
                <span className="block text-sm font-medium">{t("showOnLeaderboard")}</span>
                <span className="block text-xs text-muted-foreground">{t("showOnLeaderboardHint")}</span>
              </span>
            </label>
          )}
        </CardContent>
      </Card>

      {/* 学习时区 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("learningTimezone")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {t("timezoneHint")}
          </p>
          {prefsLoading ? (
            <p className="text-sm text-muted-foreground">{t("loadingPrefs")}</p>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                {t("currentPreference")}
                {savedTimeZone != null && savedTimeZone !== ""
                  ? learningTimeZoneOptionLabel(savedTimeZone)
                  : t("notFixed")}
              </p>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("commonTimezones")}</label>
                <Select
                  value={selectControlValue}
                  onValueChange={(v) => {
                    const s = typeof v === "string" ? v : "";
                    setDraftTimeZone(s === FOLLOW_BROWSER_SELECT_VALUE ? "" : s);
                  }}
                >
                  <SelectTrigger size="default" className="w-full max-w-lg min-w-0 h-9 py-2">
                    <SelectValue placeholder={t("selectTimezone")}>
                      {(val: string | null) => {
                        if (!val || val === FOLLOW_BROWSER_SELECT_VALUE) {
                          return t("followBrowser");
                        }
                        return learningTimeZoneOptionLabel(val);
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent alignItemWithTrigger={false} className="max-h-72 max-w-[min(100vw-2rem,28rem)]">
                    <SelectGroup>
                      <SelectItem value={FOLLOW_BROWSER_SELECT_VALUE}>
                        {t("followBrowser")}
                      </SelectItem>
                    </SelectGroup>
                    {LEARNING_TIMEZONE_GROUPS.map((g) => (
                      <SelectGroup key={g.regionKey}>
                        <SelectLabel>{t(`timezoneGroup.${g.regionKey}`)}</SelectLabel>
                        {g.iana.map((iana) => (
                          <SelectItem key={iana} value={iana}>
                            {learningTimeZoneOptionLabel(iana)}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                    {showCustomSelectItem ? (
                      <SelectGroup>
                        <SelectLabel>{t("customDraftLabel")}</SelectLabel>
                        <SelectItem value={draftTimeZone.trim()}>
                          {learningTimeZoneOptionLabel(draftTimeZone.trim())}
                        </SelectItem>
                      </SelectGroup>
                    ) : null}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {t("timezoneOffsetHint")}
                </p>
              </div>
              <div className="space-y-2">
                <label htmlFor="tz-custom" className="text-sm font-medium">
                  {t("otherTimezone")}
                </label>
                <Input
                  id="tz-custom"
                  placeholder={t("otherTimezonePlaceholder")}
                  value={draftTimeZone}
                  onChange={(e) => setDraftTimeZone(e.target.value)}
                  className="max-w-lg"
                  autoComplete="off"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={() => void saveTimeZone()} disabled={savingTz}>
                  {savingTz ? t("saving") : t("save")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={savingTz}
                  onClick={() => {
                    setDraftTimeZone("");
                    void (async () => {
                      setDraftTimeZone("");
                      setSavingTz(true);
                      try {
                        const r = await clientFetch("/api/user/preferences", {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ timeZone: null }),
                        });
                        if (!r.ok) return;
                        setSavedTimeZone(null);
                        setDraftTimeZone("");
                        toast.success(t("timezoneFollowBrowser"));
                      } finally {
                        setSavingTz(false);
                      }
                    })();
                  }}
                >
                  {t("clearTimezone")}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* 外观 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("appearance")}</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">{t("themeMode")}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t("themeModeHint")}
            </p>
          </div>
          <ThemeToggle />
        </CardContent>
      </Card>

      {/* 语言 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("language")}</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{t("languageHint")}</p>
          <LocaleSwitcher />
        </CardContent>
      </Card>

      {/* 关于 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("about")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <div className="space-y-1">
            <p className="font-medium text-foreground">{t("aboutAuthorTitle")}</p>
            <p>{t("aboutAuthor")}</p>
          </div>
          <p>{t("aboutVersion")}</p>
          <p>{t("aboutAlgo")}</p>
          <div className="space-y-2 pt-1 border-t border-border">
            <p className="font-medium text-foreground">{t("feedback")}</p>
            <p className="text-xs">{t("feedbackHint")}</p>
            <div className="space-y-3">
              <p>
                <a
                  href={`mailto:${FEEDBACK_EMAIL}`}
                  className="inline-flex items-center gap-1.5 text-foreground underline-offset-4 hover:underline"
                >
                  <Mail className="h-4 w-4 shrink-0" aria-hidden />
                  {t("sendEmail")}
                </a>
                <span className="block text-xs mt-1 tabular-nums">{FEEDBACK_EMAIL}</span>
              </p>
              <p>
                <a
                  href={GITHUB_REPO_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-foreground underline-offset-4 hover:underline"
                >
                  <ExternalLink className="h-4 w-4 shrink-0" aria-hidden />
                  {t("github")}
                </a>
                <span className="block text-xs mt-1 break-all">{GITHUB_REPO_URL}</span>
                <span className="block text-xs mt-1">{t("githubHint")}</span>
              </p>
            </div>
          </div>
          <div className="space-y-2 pt-1 border-t border-border">
            <p className="font-medium text-foreground">{t("thanksTitle")}</p>
            <p className="text-xs text-muted-foreground pt-2">{t("thanksSites")}</p>
            <ul className="text-xs text-muted-foreground list-disc list-inside space-y-0.5">
              <li>
                {t("levelReadThanks")}{" "}
                <a
                  href="https://levelread.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-foreground underline-offset-4 hover:underline"
                >
                  https://levelread.com
                </a>
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* 退出登录 */}
      <Card className="border-destructive/30">
        <CardContent className="pt-6">
          <Button
            variant="destructive"
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="w-full"
          >
            <LogOut className="h-4 w-4 mr-2" />
            {t("logout")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
