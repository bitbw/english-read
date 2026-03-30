"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, BookmarkPlus, BookmarkCheck, X } from "lucide-react";

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
  position: { x: number; y: number };
  onClose: () => void;
  onSaved: () => void;
}

export function WordPopup({
  word,
  context,
  contextCfi,
  bookId,
  position,
  onClose,
  onSaved,
}: WordPopupProps) {
  const [phonetic, setPhonetic] = useState("");
  const [definitions, setDefinitions] = useState<Definition[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const popupRef = useRef<HTMLDivElement>(null);

  // 查询释义
  useEffect(() => {
    async function fetchDefinition() {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/dictionary?word=${encodeURIComponent(word)}`
        );
        const data = await res.json();
        setPhonetic(data.phonetic ?? "");
        setDefinitions(data.definitions ?? []);
      } catch {
        setDefinitions([]);
      } finally {
        setLoading(false);
      }
    }
    fetchDefinition();
  }, [word]);

  // 计算弹窗位置（防止超出视口）
  const popupStyle: React.CSSProperties = {
    position: "absolute",
    left: Math.max(8, Math.min(position.x - 140, window.innerWidth - 300)),
    top: position.y > 150 ? position.y - 160 : position.y + 24,
    zIndex: 50,
    width: 280,
  };

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
        onSaved();
      }
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      ref={popupRef}
      style={popupStyle}
      className="bg-popover border border-border rounded-lg shadow-lg p-3 text-sm"
    >
      {/* 标题行 */}
      <div className="flex items-start justify-between mb-2">
        <div>
          <span className="font-bold text-base">{word}</span>
          {phonetic && (
            <span className="ml-2 text-muted-foreground text-xs">{phonetic}</span>
          )}
        </div>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground ml-2 shrink-0"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* 释义 */}
      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground py-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span>查询中...</span>
        </div>
      ) : definitions.length > 0 ? (
        <div className="space-y-1.5 mb-3 max-h-32 overflow-y-auto">
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
      ) : (
        <p className="text-xs text-muted-foreground mb-3">暂无释义</p>
      )}

      {/* 上下文 */}
      {context && (
        <p className="text-xs text-muted-foreground italic mb-3 line-clamp-2 border-l-2 border-muted pl-2">
          {context}
        </p>
      )}

      {/* 操作按钮 */}
      <Button
        size="sm"
        className="w-full h-7 text-xs"
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
