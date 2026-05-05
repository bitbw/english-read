import type { Rendition } from "epubjs";

const DEFAULT_VIEWPORT_W = 600;
const DEFAULT_VIEWPORT_H = 800;

/** 分页 `renderTo` / `resize` 共用的宿主像素尺寸。 */
export function viewerPixelDimensions(viewerEl: HTMLElement): {
  width: number;
  height: number;
} {
  const vr = viewerEl.getBoundingClientRect();
  return {
    width: Math.floor(vr.width) || DEFAULT_VIEWPORT_W,
    height: Math.floor(vr.height) || DEFAULT_VIEWPORT_H,
  };
}

/**
 * 回显上次阅读位置：先立即 `display` 一次，再在双 `requestAnimationFrame` 后 `display` 一次，
 * 等布局与 iframe 稳定后再对齐，避免仅单次 display 时的分页错位。
 */
export async function displayInitialReadingPosition(
  rendition: Rendition,
  initialCfi: string | null | undefined,
  isMounted: () => boolean
): Promise<void> {
  const startCfi = initialCfi?.trim();
  if (startCfi) {
    await rendition.display(startCfi);
  } else {
    await rendition.display();
  }

  requestAnimationFrame(() => {
    requestAnimationFrame(async () => {
      if (!isMounted()) return;
      if (startCfi) {
        await rendition.display(startCfi);
      } else {
        await rendition.display();
      }
    });
  });
}

/** 将 rendition 视口同步为宿主容器的像素尺寸（分页模式依赖具体宽高）。 */
export function resizeRenditionToViewer(
  rendition: Rendition,
  viewerEl: HTMLElement
): void {
  const { width, height } = viewerPixelDimensions(viewerEl);
  rendition.resize(width, height);
}
