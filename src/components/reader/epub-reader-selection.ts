import type { WordPopupAnchorRect } from "./word-popup";

/** 将 Range 的所有 client rects 合并为一块包围盒（适配多行选区）；无有效矩形时返回 null。 */
export function unionRangeRects(range: Range): DOMRect | null {
  if (range.collapsed) return null;
  const rects = range.getClientRects();
  let u: DOMRect | null = null;
  for (let i = 0; i < rects.length; i++) {
    const r = rects[i];
    if (r.width === 0 && r.height === 0) continue;
    if (!u) {
      u = new DOMRect(r.left, r.top, r.width, r.height);
    } else {
      const left = Math.min(u.left, r.left);
      const top = Math.min(u.top, r.top);
      const right = Math.max(u.right, r.right);
      const bottom = Math.max(u.bottom, r.bottom);
      u = new DOMRect(left, top, right - left, bottom - top);
    }
  }
  return u;
}

/** iframe 内 Range → 宿主视口坐标下的查词弹层锚点矩形 */
export function wordPopupAnchorFromIframeRange(
  range: Range,
  iframe: HTMLIFrameElement
): WordPopupAnchorRect | null {
  const local = unionRangeRects(range);
  if (!local) return null;
  const ir = iframe.getBoundingClientRect();
  return {
    top: local.top + ir.top,
    left: local.left + ir.left,
    right: local.right + ir.left,
    bottom: local.bottom + ir.top,
    width: local.width,
    height: local.height,
  };
}

/** 从 Range 的常见祖先截取段落摘录（与 Selection 路径同级，供 CFI→Range 后不依赖 live Selection）。 */
export function paragraphSnippetFromRange(range: Range): string {
  const anc = range.commonAncestorContainer;
  const el =
    anc.nodeType === Node.ELEMENT_NODE
      ? (anc as Element)
      : anc.parentElement;
  return (
    el?.closest("p")?.textContent?.trim() ??
    el?.textContent?.trim() ??
    ""
  );
}

/** 将选区内多个 Range 的包围矩形合并为一个，用于弹层锚定。 */
export function unionSelectionRects(sel: Selection): DOMRect | null {
  if (sel.rangeCount === 0) return null;
  let u: DOMRect | null = null;
  for (let i = 0; i < sel.rangeCount; i++) {
    const r = sel.getRangeAt(i).getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    if (!u) {
      u = new DOMRect(r.left, r.top, r.width, r.height);
    } else {
      const left = Math.min(u.left, r.left);
      const top = Math.min(u.top, r.top);
      const right = Math.max(u.right, r.right);
      const bottom = Math.max(u.bottom, r.bottom);
      u = new DOMRect(left, top, right - left, bottom - top);
    }
  }
  return u;
}

/** iframe 内选区 → 宿主视口坐标下的查词弹层锚点矩形；无效时返回 null。 */
export function wordPopupAnchorFromIframeSelection(
  sel: Selection,
  iframe: HTMLIFrameElement
): WordPopupAnchorRect | null {
  const local = unionSelectionRects(sel);
  if (!local) return null;
  const ir = iframe.getBoundingClientRect();
  return {
    top: local.top + ir.top,
    left: local.left + ir.left,
    right: local.right + ir.left,
    bottom: local.bottom + ir.top,
    width: local.width,
    height: local.height,
  };
}

/** 划词所在段落（或父节点）的纯文本，供摘录上下文。 */
export function paragraphSnippetFromSelection(sel: Selection): string {
  return (
    sel.anchorNode?.parentElement?.closest("p")?.textContent?.trim() ??
    sel.anchorNode?.parentElement?.textContent?.trim() ??
    ""
  );
}
