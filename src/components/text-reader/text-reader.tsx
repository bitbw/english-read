"use client";

import { useEffect, useState } from "react";
import { BackButton } from "@/components/back-button";
import { useTranslations } from "next-intl";
import { TextReaderInput, TEXT_READER_DRAFT_KEY } from "./text-reader-input";
import { TextReaderRead } from "./text-reader-read";
import { plainTextToHtml, sanitizeRichText } from "./rich-text";

export function TextReader() {
  const t = useTranslations("textreader");
  const [mode, setMode] = useState<"input" | "read">("input");
  const [draft, setDraft] = useState("");
  const [draftLoaded, setDraftLoaded] = useState(false);

  // 草稿持久化到 localStorage，刷新/重进不丢
  useEffect(() => {
    try {
      const saved = localStorage.getItem(TEXT_READER_DRAFT_KEY);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed?.version === 1 && typeof parsed.html === "string") {
            setDraft(sanitizeRichText(parsed.html));
            return;
          }
        } catch {
          // Existing drafts were plain text.
        }
        if (saved.trim()) setDraft(plainTextToHtml(saved));
      }
    } catch {
      // 忽略
    } finally {
      setDraftLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!draftLoaded) return;
    try {
      if (draft.trim()) {
        localStorage.setItem(TEXT_READER_DRAFT_KEY, JSON.stringify({ version: 1, html: draft }));
      } else {
        localStorage.removeItem(TEXT_READER_DRAFT_KEY);
      }
    } catch {
      // 忽略
    }
  }, [draft, draftLoaded]);

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
