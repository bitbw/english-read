"use client";

import { useState, useEffect } from "react";
import { WordCard } from "@/components/vocabulary/word-card";
import { VocabularyWordTable } from "@/components/vocabulary/vocabulary-word-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { GraduationCap, LayoutGrid, Plus, Search, Table2, Calendar } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { clientFetch } from "@/lib/client-fetch";
import { toastConfirmAction } from "@/lib/toast-confirm";
import { ManualAddVocabularyDialog } from "@/components/vocabulary/manual-add-vocabulary-dialog";

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

const VOCAB_VIEW_STORAGE_KEY = "english-read-vocabulary-view";

type VocabViewMode = "card" | "table";

export default function VocabularyPage() {
  const [words, setWords] = useState<VocabWord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>("all");
  const [search, setSearch] = useState("");
  const [dueCount, setDueCount] = useState(0);
  const [addOpen, setAddOpen] = useState(false);
  const [viewMode, setViewMode] = useState<VocabViewMode>("card");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(VOCAB_VIEW_STORAGE_KEY);
      if (raw === "card" || raw === "table") setViewMode(raw);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(VOCAB_VIEW_STORAGE_KEY, viewMode);
    } catch {
      /* ignore */
    }
  }, [viewMode]);

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

  async function handleManualAdded() {
    await fetchWords();
    await fetchDueCount();
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
    <div
      className={cn(
        "mx-auto space-y-6",
        viewMode === "table" ? "max-w-6xl" : "max-w-3xl"
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div className="min-w-0 shrink-0">
          <h1 className="text-2xl font-bold">生词本</h1>
          <p className="text-sm text-muted-foreground mt-0.5 whitespace-nowrap sm:whitespace-normal">
            共 {words.length} 条
          </p>
        </div>
        <div className="flex w-full flex-row flex-wrap gap-2 sm:w-auto sm:shrink-0 sm:justify-end">
          <Button
            type="button"
            variant="outline"
            className="inline-flex flex-1 min-h-10 items-center justify-center gap-2 sm:flex-initial"
            onClick={() => setAddOpen(true)}
          >
            <Plus className="h-4 w-4 shrink-0" />
            <span className="truncate">手动添加</span>
          </Button>
          <ManualAddVocabularyDialog
            open={addOpen}
            onOpenChange={setAddOpen}
            onAdded={handleManualAdded}
          />
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

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
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
          <div
            className="inline-flex rounded-lg border border-foreground/10 bg-muted/30 p-0.5"
            role="group"
            aria-label="展示形式"
          >
            <Button
              type="button"
              variant={viewMode === "card" ? "secondary" : "ghost"}
              size="icon"
              className="h-8 w-8"
              onClick={() => setViewMode("card")}
              title="卡片"
              aria-pressed={viewMode === "card"}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant={viewMode === "table" ? "secondary" : "ghost"}
              size="icon"
              className="h-8 w-8"
              onClick={() => setViewMode("table")}
              title="表格"
              aria-pressed={viewMode === "table"}
            >
              <Table2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="relative flex-1 sm:max-w-xs sm:min-w-[200px]">
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
        viewMode === "table" ? (
          <div className="overflow-hidden rounded-xl border border-foreground/10">
            <Skeleton className="h-9 w-full rounded-none" />
            {[...Array(8)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-none border-t border-foreground/5" />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-lg" />)}
          </div>
        )
      ) : words.length > 0 ? (
        viewMode === "table" ? (
          <VocabularyWordTable words={words} onDelete={handleDelete} />
        ) : (
          <div className="space-y-3">
            {words.map((word) => (
              <WordCard
                key={word.id}
                word={{ ...word, nextReviewAt: new Date(word.nextReviewAt), createdAt: new Date(word.createdAt) }}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )
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
