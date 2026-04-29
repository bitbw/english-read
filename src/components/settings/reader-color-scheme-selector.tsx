"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { cn } from "@/lib/utils";
import {
  type ReaderColorSchemeId,
  READER_COLOR_SCHEMES,
  getColorSchemeLabel,
  getColorSchemeDescription,
  writeColorSchemeToStorage,
} from "@/lib/reader-color-scheme";

const SCHEME_IDS: ReaderColorSchemeId[] = ["a", "b", "c"];

interface ReaderColorSchemeSelectorProps {
  value: ReaderColorSchemeId;
  onChange: (id: ReaderColorSchemeId) => void;
}

/** 每项左侧的色块预览（暗/亮双色条，示意背景与文字色对比）。 */
function ColorSwatch({ schemeId }: { schemeId: ReaderColorSchemeId }) {
  const scheme = READER_COLOR_SCHEMES[schemeId];
  return (
    <div className="flex shrink-0 flex-col gap-px rounded-md border border-border p-1.5">
      <div
        className="h-5 w-12 rounded-sm px-1 py-0.5 text-[10px] leading-none font-medium"
        style={{
          backgroundColor: scheme.dark.bg,
          color: scheme.dark.fg,
        }}
      >
        Aa
      </div>
      <div
        className="h-5 w-12 rounded-sm px-1 py-0.5 text-[10px] leading-none font-medium"
        style={{
          backgroundColor: scheme.light.bg,
          color: scheme.light.fg,
        }}
      >
        Aa
      </div>
    </div>
  );
}

export function ReaderColorSchemeSelector({
  value,
  onChange,
}: ReaderColorSchemeSelectorProps) {
  const t = useTranslations("settings");
  const locale = useLocale() as "zh" | "en";

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">{t("readerColorScheme")}</p>
      <p className="text-xs text-muted-foreground">
        {t("readerColorSchemeHint")}
      </p>
      <div className="flex flex-col gap-2">
        {SCHEME_IDS.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              writeColorSchemeToStorage(id);
              onChange(id);
            }}
            className={cn(
              "flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors",
              value === id
                ? "border-primary bg-primary/5 ring-1 ring-primary"
                : "border-border hover:border-foreground/20"
            )}
          >
            <ColorSwatch schemeId={id} />
            <div className="min-w-0">
              <p className="text-sm font-medium">
                {getColorSchemeLabel(id, locale)}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {getColorSchemeDescription(id, locale)}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
