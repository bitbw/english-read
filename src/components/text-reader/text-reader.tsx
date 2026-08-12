"use client";

import { useEffect, useState } from "react";
import { BackButton } from "@/components/back-button";
import { useTranslations } from "next-intl";
import { TextReaderInput, TEXT_READER_DRAFT_KEY } from "./text-reader-input";
import { TextReaderRead } from "./text-reader-read";

export function TextReader() {
  const t = useTranslations("textreader");
  const [mode, setMode] = useState<"input" | "read">("input");
  const [draft, setDraft] = useState("");

  // 草稿持久化到 localStorage，刷新/重进不丢
  useEffect(() => {
    try {
      const saved = localStorage.getItem(TEXT_READER_DRAFT_KEY);
      if (saved && saved.trim()) setDraft(saved);
    } catch {
      // 忽略
    }
  }, []);

  useEffect(() => {
    try {
      if (draft.trim()) {
        localStorage.setItem(TEXT_READER_DRAFT_KEY, draft);
      } else {
        localStorage.removeItem(TEXT_READER_DRAFT_KEY);
      }
    } catch {
      // 忽略
    }
  }, [draft]);

  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-2">
        <BackButton fallbackHref="/dashboard" />
        <h1 className="text-xl font-bold">{t("title")}</h1>
      </div>

      {mode === "input" ? (
        <TextReaderInput
          draft={draft}
          onChange={setDraft}
          onStart={() => setMode("read")}
        />
      ) : (
        <TextReaderRead text={draft} onEdit={() => setMode("input")} />
      )}
    </div>
  );
}