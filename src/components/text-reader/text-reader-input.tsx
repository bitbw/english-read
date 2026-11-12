"use client";

import { useEffect, useRef } from "react";
import type { ClipboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Play, Trash2 } from "lucide-react";
import { plainTextToHtml, richTextToPlainText, sanitizeRichText } from "./rich-text";

export const TEXT_READER_DRAFT_KEY = "english-read-text-reader-draft";
export const TEXT_READER_LIMIT = 5000;

interface TextReaderInputProps {
  draft: string;
  onChange: (next: string) => void;
  onStart: () => void;
}

export function TextReaderInput({ draft, onChange, onStart }: TextReaderInputProps) {
  const t = useTranslations("textreader");
  const editorRef = useRef<HTMLDivElement>(null);
  const lastValidHtmlRef = useRef(draft);
  const plainText = richTextToPlainText(draft);
  const count = plainText.trim() ? plainText.trim().split(/\s+/).filter(Boolean).length : 0;

  useEffect(() => {
    const editor = editorRef.current;
    if (editor && sanitizeRichText(editor.innerHTML) !== draft) editor.innerHTML = draft;
    lastValidHtmlRef.current = draft;
  }, [draft]);

  function handleInput() {
    const editor = editorRef.current;
    if (!editor) return;
    const html = sanitizeRichText(editor.innerHTML);
    if (richTextToPlainText(html).length > TEXT_READER_LIMIT) {
      editor.innerHTML = lastValidHtmlRef.current;
      toast.error(t("limitError", { count: TEXT_READER_LIMIT }));
      return;
    }
    lastValidHtmlRef.current = html;
    onChange(html);
  }

  function handlePaste(event: ClipboardEvent<HTMLDivElement>) {
    event.preventDefault();
    const editor = editorRef.current;
    if (!editor) return;

    const clipboard = event.clipboardData;
    const pastedHtml = clipboard.getData("text/html");
    const html = pastedHtml ? sanitizeRichText(pastedHtml) : plainTextToHtml(clipboard.getData("text/plain"));
    const selection = window.getSelection();
    const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
    const selectedText = range && editor.contains(range.commonAncestorContainer) ? range.toString().length : 0;
    const currentLength = richTextToPlainText(editor.innerHTML).length;
    if (currentLength - selectedText + richTextToPlainText(html).length > TEXT_READER_LIMIT) {
      toast.error(t("limitError", { count: TEXT_READER_LIMIT }));
      return;
    }

    if (range && editor.contains(range.commonAncestorContainer)) {
      document.execCommand("insertHTML", false, html);
    } else {
      editor.insertAdjacentHTML("beforeend", html);
    }
    handleInput();
  }

  function handleStart() {
    if (!plainText.trim()) {
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
        <div
          id="text-reader-input"
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          aria-label={t("textareaLabel")}
          data-placeholder={t("inputPlaceholder")}
          onInput={handleInput}
          onPaste={handlePaste}
          className="min-h-[240px] max-h-[60vh] overflow-y-auto w-full rounded-lg border border-input bg-transparent px-3 py-2 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground md:text-sm dark:bg-input/30 [&_h1]:text-3xl [&_h1]:font-bold [&_h2]:text-2xl [&_h2]:font-bold [&_h3]:text-xl [&_h3]:font-semibold [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6"
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
