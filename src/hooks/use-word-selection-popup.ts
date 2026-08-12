"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { debounce } from "@/lib/debounce";
import { extractReadableContext } from "@/lib/extract-readable-context";
import {
  VOCAB_CONTEXT_MAX_LENGTH,
  VOCAB_WORD_MAX_LENGTH,
} from "@/lib/vocabulary-limits";
import type { WordPopupAnchorRect } from "@/components/reader/word-popup";

export interface WordSelectionPopup {
  word: string;
  context: string;
  anchorRect: WordPopupAnchorRect;
}

/**
 * 划词检测：在指定区域（refs）内监听 mouseup/touchend/selectionchange，
 * 选中一个词时返回其释义所需的数据，用于打开 WordPopup。
 * 逻辑与 articles 阅读页一致，供文章页与文本练习页复用。
 */
export function useWordSelectionPopup(
  refs: Array<{ current: HTMLElement | null }>,
  delayMs = 300,
) {
  const [popup, setPopup] = useState<WordSelectionPopup | null>(null);

  // refs 数组每次渲染都是新引用，但内部 ref 对象稳定；
  // 事件回调只读 .current，用 ref 兜住避免每次渲染重绑监听。
  const refsRef = useRef(refs);
  refsRef.current = refs;

  const closePopup = useCallback(() => {
    setPopup(null);
    window.getSelection()?.removeAllRanges();
  }, []);

  useEffect(() => {
    function handlePointerUp(e: MouseEvent | TouchEvent) {
      const target = e.target as Node;
      const popupEl = document.querySelector("[data-word-popup]");
      if (popupEl?.contains(target)) return;

      // 移动端 touchend 在选区提交前触发：无选中时仍关闭弹窗
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || !selection.rangeCount) {
        if (!(e.target as HTMLElement)?.closest?.("[data-word-popup]")) {
          setPopup(null);
        }
      }
    }

    const debouncedSelect = debounce(() => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || !selection.rangeCount) {
        return;
      }

      const word = selection.toString().trim();
      if (!word || word.length > VOCAB_WORD_MAX_LENGTH) {
        return;
      }

      const range = selection.getRangeAt(0);
      const inRange = refsRef.current.some(
        (r) => r.current?.contains(range.commonAncestorContainer) ?? false,
      );
      if (!inRange) {
        return;
      }

      const rect = range.getBoundingClientRect();
      // getBoundingClientRect 可能在选区渲染完成前返回零矩形
      if (rect.width === 0 && rect.height === 0) {
        return;
      }

      // 智能上下文提取：优先整段，其次完整句，最后按词边界截断
      const fullText = range.startContainer.textContent ?? "";
      const startOffset = range.startOffset;
      const wordEndOffset = startOffset + word.length;
      const context = extractReadableContext(
        fullText,
        startOffset,
        wordEndOffset,
        VOCAB_CONTEXT_MAX_LENGTH,
      );

      // 避免对同一词重复触发
      setPopup((prev) => {
        if (prev?.word === word) return prev;
        return {
          word,
          context,
          anchorRect: {
            top: rect.top,
            left: rect.left,
            right: rect.right,
            bottom: rect.bottom,
            width: rect.width,
            height: rect.height,
          },
        };
      });
    }, delayMs);

    document.addEventListener("mouseup", handlePointerUp);
    document.addEventListener("touchend", handlePointerUp as EventListener);
    document.addEventListener("selectionchange", debouncedSelect);
    return () => {
      document.removeEventListener("mouseup", handlePointerUp);
      document.removeEventListener("touchend", handlePointerUp as EventListener);
      document.removeEventListener("selectionchange", debouncedSelect);
      debouncedSelect.cancel();
    };
  }, [delayMs]);

  return { popup, closePopup };
}