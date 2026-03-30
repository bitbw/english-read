"use client";

import { useState, useEffect } from "react";
import { WordCard } from "@/components/vocabulary/word-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { GraduationCap, Search } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

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

  async function fetchWords() {
    setLoading(true);
    try {
      const res = await fetch(`/api/vocabulary?filter=${filter}&search=${encodeURIComponent(search)}`);
      const data = await res.json();
      setWords(data);
    } finally {
      setLoading(false);
    }
  }

  async function fetchDueCount() {
    const res = await fetch("/api/review");
    const data = await res.json();
    setDueCount(Array.isArray(data) ? data.length : 0);
  }

  useEffect(() => { fetchWords(); }, [filter, search]);
  useEffect(() => { fetchDueCount(); }, []);

  async function handleDelete(id: string) {
    const res = await fetch(`/api/vocabulary/${id}`, { method: "DELETE" });
    if (res.ok) {
      setWords((prev) => prev.filter((w) => w.id !== id));
      toast.success("已从生词本删除");
    }
  }

  const filters: { value: FilterType; label: string }[] = [
    { value: "all", label: "全部" },
    { value: "pending", label: "复习中" },
    { value: "mastered", label: "已掌握" },
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">生词本</h1>
          <p className="text-sm text-muted-foreground mt-0.5">共 {words.length} 个单词</p>
        </div>
        {dueCount > 0 && (
          <Link href="/vocabulary/review" className={cn(buttonVariants())}>
            <GraduationCap className="h-4 w-4 mr-2" />
            开始复习
            <Badge variant="secondary" className="ml-2">{dueCount}</Badge>
          </Link>
        )}
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
          {!search && <p className="text-sm mt-2">阅读电子书时选中单词即可加入生词本</p>}
        </div>
      )}
    </div>
  );
}
