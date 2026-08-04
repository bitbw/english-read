"use client";

import { useEffect, useState, useCallback } from "react";
import { useLocale } from "next-intl";
import { BackButton } from "@/components/back-button";
import { clientFetch } from "@/lib/client-fetch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
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
import { Badge } from "@/components/ui/badge";
import { PlusIcon, PencilIcon, Trash2Icon } from "lucide-react";
import type { AnnouncementItem } from "@/app/api/announcements/route";

type Status = "draft" | "published" | "archived";

const STATUS_LABELS: Record<Status, string> = {
  draft: "草稿",
  published: "已发布",
  archived: "已归档",
};

const STATUS_COLORS: Record<Status, "secondary" | "default" | "outline"> = {
  draft: "secondary",
  published: "default",
  archived: "outline",
};

interface FormData {
  titleZh: string;
  titleEn: string;
  contentZh: string;
  contentEn: string;
  linkUrl: string;
  linkLabelZh: string;
  linkLabelEn: string;
  priority: number;
  status: Status;
  publishedAt: string;
  expiresAt: string;
}

const EMPTY_FORM: FormData = {
  titleZh: "",
  titleEn: "",
  contentZh: "",
  contentEn: "",
  linkUrl: "",
  linkLabelZh: "",
  linkLabelEn: "",
  priority: 0,
  status: "draft",
  publishedAt: "",
  expiresAt: "",
};

export function AnnouncementManager() {
  const locale = useLocale();
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AnnouncementItem | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await clientFetch("/api/admin/announcements", { showErrorToast: false });
      if (!r.ok) {
        setError("加载失败");
        return;
      }
      const json = (await r.json()) as { announcements: AnnouncementItem[] };
      setAnnouncements(json.announcements);
    } catch {
      setError("加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
  };

  const openCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (item: AnnouncementItem) => {
    setForm({
      titleZh: item.titleZh,
      titleEn: item.titleEn ?? "",
      contentZh: item.contentZh,
      contentEn: item.contentEn ?? "",
      linkUrl: item.linkUrl ?? "",
      linkLabelZh: item.linkLabelZh ?? "",
      linkLabelEn: item.linkLabelEn ?? "",
      priority: item.priority,
      status: item.status,
      publishedAt: item.publishedAt ? item.publishedAt.slice(0, 16) : "",
      expiresAt: item.expiresAt ? item.expiresAt.slice(0, 16) : "",
    });
    setEditingId(item.id);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        titleZh: form.titleZh,
        titleEn: form.titleEn || null,
        contentZh: form.contentZh,
        contentEn: form.contentEn || null,
        linkUrl: form.linkUrl || null,
        linkLabelZh: form.linkLabelZh || null,
        linkLabelEn: form.linkLabelEn || null,
        priority: form.priority,
        status: form.status,
        publishedAt: form.publishedAt ? new Date(form.publishedAt).toISOString() : null,
        expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
      };

      const r = editingId
        ? await clientFetch(`/api/admin/announcements/${editingId}`, {
            method: "PUT",
            body: JSON.stringify(body),
          })
        : await clientFetch("/api/admin/announcements", {
            method: "POST",
            body: JSON.stringify(body),
          });

      if (!r.ok) {
        const json = (await r.json()) as { error?: string };
        alert(json.error ?? "保存失败");
        return;
      }

      setDialogOpen(false);
      resetForm();
      await load();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const r = await clientFetch(`/api/admin/announcements/${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (!r.ok) {
        alert("删除失败");
        return;
      }
      setDeleteTarget(null);
      await load();
    } catch {
      alert("删除失败");
    }
  };

  const formatTime = (iso: string | null) => {
    if (!iso) return "-";
    return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <BackButton fallbackHref="/admin" label="返回管理后台" />
        <h1 className="text-2xl font-bold flex-1 min-w-0">公告管理</h1>
        <Button onClick={openCreate}>
          <PlusIcon className="h-4 w-4 mr-1" />
          创建公告
        </Button>
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
      ) : announcements.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            暂无公告
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>标题</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="text-right">优先级</TableHead>
                  <TableHead>发布时间</TableHead>
                  <TableHead>过期时间</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {announcements.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">
                      {locale === "zh" ? item.titleZh : (item.titleEn ?? item.titleZh)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_COLORS[item.status]}>
                        {STATUS_LABELS[item.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{item.priority}</TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums">
                      {formatTime(item.publishedAt)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums">
                      {formatTime(item.expiresAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon-sm" onClick={() => openEdit(item)}>
                          <PencilIcon className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setDeleteTarget(item)}
                        >
                          <Trash2Icon className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* 创建/编辑弹窗 */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "编辑公告" : "创建公告"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>标题（中文）*</Label>
                <Input
                  value={form.titleZh}
                  onChange={(e) => setForm({ ...form, titleZh: e.target.value })}
                  placeholder="系统维护通知"
                />
              </div>
              <div className="space-y-2">
                <Label>标题（英文）</Label>
                <Input
                  value={form.titleEn}
                  onChange={(e) => setForm({ ...form, titleEn: e.target.value })}
                  placeholder="Maintenance Notice"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>内容（中文）*</Label>
                <Textarea
                  value={form.contentZh}
                  onChange={(e) => setForm({ ...form, contentZh: e.target.value })}
                  placeholder="系统将于..."
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label>内容（英文）</Label>
                <Textarea
                  value={form.contentEn}
                  onChange={(e) => setForm({ ...form, contentEn: e.target.value })}
                  placeholder="The system will..."
                  rows={3}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>链接 URL</Label>
                <Input
                  value={form.linkUrl}
                  onChange={(e) => setForm({ ...form, linkUrl: e.target.value })}
                  placeholder="https://..."
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <Label>链接文字（中文）</Label>
                  <Input
                    value={form.linkLabelZh}
                    onChange={(e) => setForm({ ...form, linkLabelZh: e.target.value })}
                    placeholder="查看详情"
                  />
                </div>
                <div className="space-y-2">
                  <Label>链接文字（英文）</Label>
                  <Input
                    value={form.linkLabelEn}
                    onChange={(e) => setForm({ ...form, linkLabelEn: e.target.value })}
                    placeholder="Learn more"
                  />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>优先级</Label>
                <Input
                  type="number"
                  value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label>状态</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) => setForm({ ...form, status: v as Status })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">草稿</SelectItem>
                    <SelectItem value="published">已发布</SelectItem>
                    <SelectItem value="archived">已归档</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>发布时间</Label>
                <Input
                  type="datetime-local"
                  value={form.publishedAt}
                  onChange={(e) => setForm({ ...form, publishedAt: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">留空则默认从现在开始</p>
              </div>
              <div className="space-y-2">
                <Label>过期时间</Label>
                <Input
                  type="datetime-local"
                  value={form.expiresAt}
                  onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
                />
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <DialogClose render={<Button variant="outline" />}>
              取消
            </DialogClose>
            <Button onClick={handleSave} disabled={saving || !form.titleZh || !form.contentZh}>
              {saving ? "保存中..." : "保存"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 删除确认弹窗 */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            确定删除公告「{deleteTarget ? (locale === "zh" ? deleteTarget.titleZh : (deleteTarget.titleEn ?? deleteTarget.titleZh)) : ""}」？此操作不可撤销。
          </p>
          <div className="flex justify-end gap-2">
            <DialogClose render={<Button variant="outline" />}>
              取消
            </DialogClose>
            <Button variant="destructive" onClick={handleDelete}>
              删除
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}