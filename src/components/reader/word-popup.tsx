"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, BookmarkPlus, BookmarkCheck, X, Volume2 } from "lucide-react";
import { toast } from "sonner";

interface Definition {
  partOfSpeech: string;
  definition: string;
  example?: string;
}

interface WordPopupProps {
  word: string;
  context: string;
  contextCfi: string;
  bookId: string;
  onClose: () => void;
  onSaved: () => void;
}

export function WordPopup({
  word,
  context,
  contextCfi,
  bookId,
  onClose,
  onSaved,
}: WordPopupProps) {
  const [phonetic, setPhonetic] = useState("");
  const [definitions, setDefinitions] = useState<Definition[]>([]);
  const [translation, setTranslation] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // 查询释义 + 中文翻译
  useEffect(() => {
    let cancelled = false;
    async function fetchDefinition() {
      setLoading(true);
      setPhonetic("");
      setDefinitions([]);
      setTranslation("");
      setSaved(false);
      try {
        const res = await fetch(`/api/dictionary?word=${encodeURIComponent(word)}`);
        const data = await res.json();
        if (cancelled) return;
        setPhonetic(data.phonetic ?? "");
        setDefinitions(data.definitions ?? []);
        setTranslation(data.translation ?? "");
      } catch {
        if (!cancelled) setDefinitions([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchDefinition();
    return () => { cancelled = true; };
  }, [word]);

  // Web Speech API 发音
  function speak() {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(word);
    utterance.lang = "en-US";
    window.speechSynthesis.speak(utterance);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const definitionStr =
        definitions.length > 0
          ? JSON.stringify(
              definitions.slice(0, 3).map((d) => ({
                pos: d.partOfSpeech,
                def: d.definition,
              }))
            )
          : undefined;

      const res = await fetch("/api/vocabulary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          word,
          bookId,
          context,
          contextCfi,
          definition: definitionStr,
          phonetic,
        }),
      });

      if (res.ok) {
        setSaved(true);
        toast.success(`"${word}" 已加入生词本`);
        onSaved();
      }
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  }

  return (
    // 固定在阅读区右上角（top 计算：顶栏 3.5rem + 阅读器顶栏约 2.5rem，共约 6rem；right 留 8px）
    <div
      className="fixed z-[100] right-2 top-24 w-72 bg-popover border border-border rounded-xl shadow-xl p-3 text-sm"
      style={{ maxHeight: "65vh", overflowY: "auto" }}
    >
      {/* 标题行：单词/词组 + 音标 + 发音 + 关闭 */}
      <div className="flex items-start justify-between gap-1 mb-2">
        <div className="flex-1 min-w-0">
          <span className="font-bold text-base break-words leading-snug">{word}</span>
          {phonetic && (
            <span className="ml-1.5 text-muted-foreground text-xs">{phonetic}</span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={speak}
            className="text-muted-foreground hover:text-foreground p-0.5 rounded"
            title="发音"
          >
            <Volume2 className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-0.5 rounded"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* 查询中 */}
      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground py-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span className="text-xs">查询中...</span>
        </div>
      ) : (
        <>
          {/* 中文翻译（放在英文释义前面，更直观） */}
          {translation && (
            <div className="mb-2 px-2 py-1.5 bg-muted/60 rounded-md">
              <p className="text-xs font-medium text-foreground">{translation}</p>
            </div>
          )}

          {/* 英文释义（单词时才有） */}
          {definitions.length > 0 && (
            <div className="space-y-1.5 mb-2 max-h-32 overflow-y-auto">
              {definitions.slice(0, 3).map((def, i) => (
                <div key={i}>
                  <Badge variant="secondary" className="text-xs mr-1 px-1 py-0">
                    {def.partOfSpeech}
                  </Badge>
                  <span className="text-xs text-foreground">{def.definition}</span>
                  {def.example && (
                    <p className="text-xs text-muted-foreground italic mt-0.5 pl-2">
                      {def.example}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* 无释义也无翻译 */}
          {!translation && definitions.length === 0 && (
            <p className="text-xs text-muted-foreground mb-2">暂无释义</p>
          )}
        </>
      )}

      {/* 上下文 */}
      {context && (
        <p className="text-xs text-muted-foreground italic mb-2 line-clamp-2 border-l-2 border-muted pl-2">
          {context}
        </p>
      )}

      {/* 加入生词本 */}
      <Button
        size="sm"
        className="w-full text-xs h-7"
        onClick={handleSave}
        disabled={saving || saved}
        variant={saved ? "secondary" : "default"}
      >
        {saving ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
        ) : saved ? (
          <BookmarkCheck className="h-3.5 w-3.5 mr-1" />
        ) : (
          <BookmarkPlus className="h-3.5 w-3.5 mr-1" />
        )}
        {saved ? "已加入生词本" : "加入生词本"}
      </Button>
    </div>
  );
}
