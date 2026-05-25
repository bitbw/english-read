"use client";

import { Settings, Volume2, VolumeX } from "lucide-react";
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
  autoPronunciation: boolean;
  onAutoPronunciationChange: (enabled: boolean) => void;
}

export function ReaderSettingsSheet({
  open,
  onOpenChange,
  fontSize,
  onFontSizeDelta,
  colorScheme,
  onColorSchemeChange,
  autoPronunciation,
  onAutoPronunciationChange,
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
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">{t("autoPronunciation")}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t("autoPronunciationHint")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onAutoPronunciationChange(!autoPronunciation)}
                className={cn(
                  "shrink-0 flex h-9 w-9 items-center justify-center rounded-md border transition-colors",
                  autoPronunciation
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:bg-accent",
                )}
                title={
                  autoPronunciation ? t("autoPronunciationOn") : t("autoPronunciationOff")
                }
                aria-pressed={autoPronunciation}
                aria-label={
                  autoPronunciation ? t("autoPronunciationOn") : t("autoPronunciationOff")
                }
              >
                {autoPronunciation ? (
                  <Volume2 className="h-4 w-4" />
                ) : (
                  <VolumeX className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
