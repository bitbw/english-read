"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { ExternalLink, LogOut } from "lucide-react";
import { toast } from "sonner";

export default function SettingsPage() {
  const router = useRouter();
  const { data: session, update } = useSession();
  const [savedTimeZone, setSavedTimeZone] = useState<string | null | undefined>(undefined);
  const [draftTimeZone, setDraftTimeZone] = useState("");
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
      const data = (await r.json()) as { timeZone?: string | null };
      const tz = data.timeZone ?? null;
      setSavedTimeZone(tz);
      setDraftTimeZone(tz ?? "");
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
      await update();
      router.refresh();
      toast.success("头像已更新");
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
      await update();
      router.refresh();
      toast.success("已移除头像");
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
      await update();
      router.refresh();
      toast.success(trimmed === "" ? "已清除显示名" : "显示名已保存");
    } finally {
      setSavingName(false);
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
      toast.success(trimmed === "" ? "已改为跟随浏览器时区" : "学习时区已保存");
    } finally {
      setSavingTz(false);
    }
  }

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">设置</h1>

      {/* 账户信息 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">账户信息</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <Avatar className="h-16 w-16 shrink-0">
              <AvatarImage src={session?.user?.image ?? ""} />
              <AvatarFallback className="text-lg">
                {(session?.user?.name?.[0] ?? session?.user?.email?.[0] ?? "U").toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1 space-y-3">
              <div>
                <p className="font-medium truncate">
                  {session?.user?.name?.trim() ? session.user.name : "未设置显示名"}
                </p>
                <p className="text-sm text-muted-foreground truncate">{session?.user?.email}</p>
              </div>
              <input
                ref={avatarFileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                aria-label="选择头像图片"
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
                  {uploadingAvatar ? "上传中…" : "上传头像"}
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
                    {removingAvatar ? "处理中…" : "移除头像"}
                  </Button>
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground">
                支持 JPG、PNG、WebP，单张最大 2MB，存储在 Vercel Blob。上传新头像时会自动替换上一张本地上传的图。
              </p>
            </div>
          </div>
          <div className="space-y-2">
            <label htmlFor="settings-display-name" className="text-sm font-medium">
              显示名
            </label>
            <Input
              id="settings-display-name"
              placeholder="可选，在应用内展示的名称"
              value={draftDisplayName}
              onChange={(e) => setDraftDisplayName(e.target.value)}
              maxLength={80}
              className="max-w-lg"
              autoComplete="nickname"
            />
            <p className="text-xs text-muted-foreground">
              邮箱注册时可以不填；OAuth 登录会预填来自提供方的名称，你可在此修改。
            </p>
            <Button type="button" onClick={() => void saveDisplayName()} disabled={savingName}>
              {savingName ? "保存中…" : "保存显示名"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 学习时区 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">学习时区</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            用于每日阅读时长、生词本日添加上限、复习排期等「哪一天」的计算。留空则使用浏览器上报的时区（与系统设置一致）。
          </p>
          {prefsLoading ? (
            <p className="text-sm text-muted-foreground">加载中…</p>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                当前生效偏好：
                {savedTimeZone != null && savedTimeZone !== ""
                  ? learningTimeZoneOptionLabel(savedTimeZone)
                  : "未固定（跟随浏览器）"}
              </p>
              <div className="space-y-2">
                <label className="text-sm font-medium">常用时区</label>
                <Select
                  value={selectControlValue}
                  onValueChange={(v) => {
                    const s = typeof v === "string" ? v : "";
                    setDraftTimeZone(s === FOLLOW_BROWSER_SELECT_VALUE ? "" : s);
                  }}
                >
                  <SelectTrigger size="default" className="w-full max-w-lg min-w-0 h-9 py-2">
                    <SelectValue placeholder="选择学习时区">
                      {(val: string | null) => {
                        if (!val || val === FOLLOW_BROWSER_SELECT_VALUE) {
                          return "跟随浏览器（与系统时区一致）";
                        }
                        return learningTimeZoneOptionLabel(val);
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent alignItemWithTrigger={false} className="max-h-72 max-w-[min(100vw-2rem,28rem)]">
                    <SelectGroup>
                      <SelectItem value={FOLLOW_BROWSER_SELECT_VALUE}>
                        跟随浏览器（与系统时区一致）
                      </SelectItem>
                    </SelectGroup>
                    {LEARNING_TIMEZONE_GROUPS.map((g) => (
                      <SelectGroup key={g.region}>
                        <SelectLabel>{g.region}</SelectLabel>
                        {g.iana.map((iana) => (
                          <SelectItem key={iana} value={iana}>
                            {learningTimeZoneOptionLabel(iana)}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                    {showCustomSelectItem ? (
                      <SelectGroup>
                        <SelectLabel>当前草稿（不在上表）</SelectLabel>
                        <SelectItem value={draftTimeZone.trim()}>
                          {learningTimeZoneOptionLabel(draftTimeZone.trim())}
                        </SelectItem>
                      </SelectGroup>
                    ) : null}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  标签中括号为当前时刻相对 GMT 的偏移（夏令时地区会随季节变化）。
                </p>
              </div>
              <div className="space-y-2">
                <label htmlFor="tz-custom" className="text-sm font-medium">
                  其它 IANA 时区
                </label>
                <Input
                  id="tz-custom"
                  placeholder="下拉没有时在此输入，如 Europe/Zurich"
                  value={draftTimeZone}
                  onChange={(e) => setDraftTimeZone(e.target.value)}
                  className="max-w-lg"
                  autoComplete="off"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={() => void saveTimeZone()} disabled={savingTz}>
                  {savingTz ? "保存中…" : "保存"}
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
                        toast.success("已改为跟随浏览器时区");
                      } finally {
                        setSavingTz(false);
                      }
                    })();
                  }}
                >
                  清除固定时区
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* 主题 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">外观</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">主题模式</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              切换浅色 / 深色 / 跟随系统
            </p>
          </div>
          <ThemeToggle />
        </CardContent>
      </Card>

      {/* 关于 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">关于</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>English Read v1.0</p>
          <p>基于 Next.js 14 + Vercel 构建的英语阅读工具</p>
          <p>词汇复习采用艾宾浩斯遗忘曲线算法</p>
          <p>
            <a
              href="https://github.com/bitbw/english-read"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-foreground underline-offset-4 hover:underline"
            >
              <ExternalLink className="h-4 w-4 shrink-0" aria-hidden />
              GitHub 开源仓库
            </a>
            <span className="block text-xs mt-1 text-muted-foreground">
              欢迎反馈问题与贡献代码
            </span>
          </p>
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
            退出登录
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
