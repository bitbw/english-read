/**
 * 注入到 EPUB iframe 内的阅读皮肤（与 globals.css 中 `.dark` / `:root` 的 background、foreground 对齐）。
 * 使用独立 style 节点并在主题切换时整体替换，避免 epubjs Themes 对 serialized 的 inject 条件问题。
 */

import type { Contents } from "epubjs";

const DARK_BG = "oklch(0.145 0 0)";
const DARK_FG = "oklch(0.985 0 0)";
const DARK_LINK = "oklch(0.72 0.12 264)";

const LIGHT_BG = "oklch(1 0 0)";
const LIGHT_FG = "oklch(0.145 0 0)";
const LIGHT_LINK = "#2563eb";

const TYPO_SELECTORS =
  "p, li, div, span, h1, h2, h3, h4, h5, h6, td, th, blockquote, figcaption, cite, pre, code";

export const READER_SKIN_STYLE_ID = "english-read-reader-skin";

export function buildReaderSkinCss(isDark: boolean): string {
  if (isDark) {
    return `
html, body {
  background: ${DARK_BG} !important;
  color: ${DARK_FG} !important;
}
${TYPO_SELECTORS} {
  color: inherit !important;
}
a {
  color: ${DARK_LINK} !important;
}
::selection {
  background: oklch(0.269 0 0) !important;
  color: ${DARK_FG} !important;
}
`.trim();
  }
  return `
html, body {
  background: ${LIGHT_BG} !important;
  color: ${LIGHT_FG} !important;
}
${TYPO_SELECTORS} {
  color: inherit !important;
}
a {
  color: ${LIGHT_LINK} !important;
}
::selection {
  background: oklch(0.97 0 0) !important;
  color: ${LIGHT_FG} !important;
}
`.trim();
}

/** 在单章 iframe 内挂载或更新阅读皮肤（主题切换时对 `getContents()` 逐项调用）。 */
export function applyReaderSkinToContents(contents: Contents, isDark: boolean): void {
  const doc = contents.document;
  if (!doc?.head) return;
  let el = doc.getElementById(READER_SKIN_STYLE_ID) as HTMLStyleElement | null;
  if (!el) {
    el = doc.createElement("style");
    el.id = READER_SKIN_STYLE_ID;
    doc.head.appendChild(el);
  }
  el.textContent = buildReaderSkinCss(isDark);
}

