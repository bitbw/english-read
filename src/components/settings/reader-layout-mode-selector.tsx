"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import {
  type ReaderLayoutMode,
  writeLayoutModeToStorage,
} from "@/lib/reader-layout-mode";
import { BookOpen, ScrollText } from "lucide-react";

const LAYOUT_MODES: ReaderLayoutMode[] = ["paginated", "scrolled-doc"];

interface ReaderLayoutModeSelectorProps {
  value: ReaderLayoutMode;
  onChange: (mode: ReaderLayoutMode) => void;
}

export function ReaderLayoutModeSelector({
  value,
  onChange,
}: ReaderLayoutModeSelectorProps) {
  const t = useTranslations("reader");

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">{t("layoutMode")}</p>
      <p className="text-xs text-muted-foreground">{t("layoutModeHint")}</p>
      <div className="flex flex-col gap-2">
        {LAYOUT_MODES.map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => {
              writeLayoutModeToStorage(mode);
              onChange(mode);
            }}
            className={cn(
              "flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors",
              value === mode
                ? "border-primary bg-primary/5 ring-1 ring-primary"
                : "border-border hover:border-foreground/20",
            )}
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-muted/50">
              {mode === "paginated" ? (
                <BookOpen className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ScrollText className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium">
                {mode === "paginated"
                  ? t("layoutModePaginated")
                  : t("layoutModeScrolled")}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {mode === "paginated"
                  ? t("layoutModePaginatedHint")
                  : t("layoutModeScrolledHint")}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
