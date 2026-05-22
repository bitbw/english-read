"use client";

import { Settings } from "lucide-react";
import { useTranslations } from "next-intl";
import { buttonVariants } from "@/components/ui/button-variants";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ReaderColorSchemeSelector } from "@/components/settings/reader-color-scheme-selector";
import type { ReaderColorSchemeId } from "@/lib/reader-color-scheme";
import { cn } from "@/lib/utils";

export interface ReaderSettingsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fontSize: number;
  onFontSizeDelta: (delta: number) => void;
  colorScheme: ReaderColorSchemeId;
  onColorSchemeChange: (id: ReaderColorSchemeId) => void;
}

export function ReaderSettingsSheet({
  open,
  onOpenChange,
  fontSize,
  onFontSizeDelta,
  colorScheme,
  onColorSchemeChange,
}: ReaderSettingsSheetProps) {
  const t = useTranslations("reader");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger
        className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "h-8 w-8 shrink-0")}
      >
        <Settings className="h-4 w-4" />
      </SheetTrigger>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="w-[min(100%,20rem)] sm:max-w-sm p-0 flex flex-col gap-0"
      >
        <div className="flex items-center gap-2 px-4 py-4 border-b border-border shrink-0">
          <Settings className="h-5 w-5 text-primary" />
          <span className="font-semibold text-base">{t("readerSettings")}</span>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-6">
          <div className="space-y-3">
            <p className="text-sm font-medium">{t("fontSize")}</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onFontSizeDelta(-2)}
                className="h-8 w-9 flex items-center justify-center rounded-md border border-border hover:bg-accent text-xs font-bold text-muted-foreground"
              >
                A-
              </button>
              <span className="text-sm text-muted-foreground w-8 text-center tabular-nums font-medium">
                {fontSize}
              </span>
              <button
                type="button"
                onClick={() => onFontSizeDelta(2)}
                className="h-8 w-9 flex items-center justify-center rounded-md border border-border hover:bg-accent font-bold text-muted-foreground"
                style={{ fontSize: "15px" }}
              >
                A+
              </button>
            </div>
          </div>
          <ReaderColorSchemeSelector
            value={colorScheme}
            onChange={onColorSchemeChange}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
