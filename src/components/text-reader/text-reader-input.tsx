"use client";

import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Play, Trash2 } from "lucide-react";

export const TEXT_READER_DRAFT_KEY = "english-read-text-reader-draft";
export const TEXT_READER_LIMIT = 5000;

interface TextReaderInputProps {
  draft: string;
  onChange: (next: string) => void;
  onStart: () => void;
}

export function TextReaderInput({ draft, onChange, onStart }: TextReaderInputProps) {
  const t = useTranslations("textreader");
  const count = draft.trim() ? draft.trim().split(/\s+/).filter(Boolean).length : 0;

  function handleStart() {
    if (!draft.trim()) {
      toast.error(t("emptyError"));
      return;
    }
    onStart();
  }

  function handleClear() {
    onChange("");
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        handleStart();
      }}
    >
      <div className="grid gap-3">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="text-reader-input" className="text-sm font-medium">
            {t("textareaLabel")}
          </Label>
          <span className="text-xs text-muted-foreground tabular-nums">
            {t("wordCount", { count })}
          </span>
        </div>
        <Textarea
          id="text-reader-input"
          value={draft}
          onChange={(e) => onChange(e.target.value)}
          placeholder={t("inputPlaceholder")}
          rows={12}
          maxLength={TEXT_READER_LIMIT}
          className="resize-y min-h-[240px]"
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClear}
            disabled={!draft}
            className="text-muted-foreground"
          >
            <Trash2 className="h-4 w-4 mr-1" />
            {t("clearDraft")}
          </Button>
          <Button type="submit" size="sm" className="gap-2">
            <Play className="h-4 w-4" />
            {t("startReading")}
          </Button>
        </div>
      </div>
    </form>
  );
}