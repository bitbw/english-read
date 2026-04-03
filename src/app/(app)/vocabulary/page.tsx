"use client";

import { useState, useEffect, type FormEvent } from "react";
import { WordCard } from "@/components/vocabulary/word-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { GraduationCap, Search, Calendar, Plus } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { clientFetch } from "@/lib/client-fetch";
import { toastConfirmAction } from "@/lib/toast-confirm";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

type FilterType = "all" | "pending" | "mastered";

interface VocabWord {
  id: string;
  word: string;
  phonetic: string | null;
  definition: string | null;
  context: string | null;
  reviewStage: number;
  nextReviewAt: string;
  isMastered: boolean;
  createdAt: string;
}

export default function VocabularyPage() {
  const [words, setWords] = useState<VocabWord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>("all");
  const [search, setSearch] = useState("");
  const [dueCount, setDueCount] = useState(0);
  const [addOpen, setAddOpen] = useState(false);
  const [addWord, setAddWord] = useState("");
  const [addReference, setAddReference] = useState("");
  const [addSubmitting, setAddSubmitting] = useState(false);

  async function fetchWords() {
    setLoading(true);
    try {
      const res = await clientFetch(
        `/api/vocabulary?filter=${filter}&search=${encodeURIComponent(search)}`
      );
      if (!res.ok) {
        setWords([]);
        return;
      }
      const data = await res.json();
      setWords(data);
    } finally {
      setLoading(false);
    }
  }

  async function fetchDueCount() {
    const res = await clientFetch("/api/review", { showErrorToast: false });
    if (!res.ok) return;
    const data = await res.json();
    const n = Array.isArray(data) ? data.length : (data.words?.length ?? 0);
    setDueCount(n);
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchWords(); }, [filter, search]);
  useEffect(() => { fetchDueCount(); }, []);

  async function handleManualAdd(e: FormEvent) {
    e.preventDefault();
    const w = addWord.trim();
    if (!w) {
      toast.error("请填写单词或短语");
      return;
    }
    setAddSubmitting(true);
    try {
      const res = await clientFetch("/api/vocabulary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          word: w,
          context: addReference.trim() || undefined,
        }),
      });
      const data = (await res.json()) as VocabWord & { alreadyExists?: boolean };
      if (!res.ok) {
        toast.error("添加失败，请稍后再试");
        return;
      }
      if (data.alreadyExists) {
        toast.message(`「${w}」已在生词本中`);
        setAddOpen(false);
        return;
      }
      toast.success(`「${w}」已加入生词本，将按复习计划提醒`);
      setAddWord("");
      setAddReference("");
      setAddOpen(false);
      await fetchWords();
      await fetchDueCount();
    } finally {
      setAddSubmitting(false);
    }
  }

  function handleDelete(id: string) {
    const word = words.find((w) => w.id === id);
    const label = word?.word ?? "该单词";
    toastConfirmAction({
      message: `确定从生词本删除「${label}」？`,
      description: "删除后需在阅读中重新添加才会回到生词本。",
      confirmLabel: "确认删除",
      onConfirm: async () => {
        const res = await clientFetch(`/api/vocabulary/${id}`, { method: "DELETE" });
        if (res.ok) {
          setWords((prev) => prev.filter((w) => w.id !== id));
          toast.success("已从生词本删除");
        }
      },
    });
  }

  const filters: { value: FilterType; label: string }[] = [
    { value: "all", label: "全部" },
    { value: "pending", label: "复习中" },
    { value: "mastered", label: "已掌握" },
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div className="min-w-0 shrink-0">
          <h1 className="text-2xl font-bold">生词本</h1>
          <p className="text-sm text-muted-foreground mt-0.5 whitespace-nowrap sm:whitespace-normal">
            共 {words.length} 条
          </p>
        </div>
        <div className="flex w-full flex-row flex-wrap gap-2 sm:w-auto sm:shrink-0 sm:justify-end">
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <Button
              type="button"
              variant="outline"
              className="inline-flex flex-1 min-h-10 items-center justify-center gap-2 sm:flex-initial"
              onClick={() => setAddOpen(true)}
            >
              <Plus className="h-4 w-4 shrink-0" />
              <span className="truncate">手动添加</span>
            </Button>
            <DialogContent className="sm:max-w-md" showCloseButton>
              <form onSubmit={handleManualAdd}>
                <DialogHeader>
                  <DialogTitle>手动添加生词</DialogTitle>
                  <DialogDescription>
                    与阅读中选词加入相同，会进入艾宾浩斯复习计划（新词次日首次复习）。
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-3 py-2">
                  <div className="grid gap-2">
                    <Label htmlFor="vocab-manual-word">单词或短语</Label>
                    <Input
                      id="vocab-manual-word"
                      value={addWord}
                      onChange={(e) => setAddWord(e.target.value)}
                      placeholder="例如：serendipity 或 in spite of"
                      maxLength={500}
                      autoComplete="off"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="vocab-manual-ref">引用（可选）</Label>
                    <Textarea
                      id="vocab-manual-ref"
                      value={addReference}
                      onChange={(e) => setAddReference(e.target.value)}
                      placeholder="原文句子、书名章节或你自己的笔记…"
                      rows={4}
                      maxLength={4000}
                      className="resize-y min-h-[88px]"
                    />
                  </div>
                </div>
                <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
                  <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>
                    取消
                  </Button>
                  <Button type="submit" disabled={addSubmitting}>
                    {addSubmitting ? "添加中…" : "加入生词本"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
          <Link
            href="/vocabulary/plan"
            className={cn(
              buttonVariants({ variant: "outline" }),
              "inline-flex flex-1 min-h-10 items-center justify-center gap-2 sm:flex-initial"
            )}
          >
            <Calendar className="h-4 w-4 shrink-0" />
            <span className="truncate">复习计划</span>
          </Link>
          {dueCount > 0 && (
            <Link
              href="/vocabulary/review"
              className={cn(
                buttonVariants(),
                "inline-flex flex-1 min-h-10 items-center justify-center gap-2 sm:flex-initial"
              )}
            >
              <GraduationCap className="h-4 w-4 shrink-0" />
              <span className="truncate">开始复习</span>
              <Badge variant="secondary" className="shrink-0">
                {dueCount}
              </Badge>
            </Link>
          )}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-1">
          {filters.map((f) => (
            <Button
              key={f.value}
              variant={filter === f.value ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(f.value)}
            >
              {f.label}
            </Button>
          ))}
        </div>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索单词..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-lg" />)}
        </div>
      ) : words.length > 0 ? (
        <div className="space-y-3">
          {words.map((word) => (
            <WordCard
              key={word.id}
              word={{ ...word, nextReviewAt: new Date(word.nextReviewAt), createdAt: new Date(word.createdAt) }}
              onDelete={handleDelete}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-lg">{search ? `没有找到"${search}"` : "生词本还没有单词"}</p>
          {!search && (
            <p className="text-sm mt-2">
              点击「手动添加」或阅读时选中单词即可加入生词本
            </p>
          )}
        </div>
      )}
    </div>
  );
}
