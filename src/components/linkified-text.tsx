import { Fragment, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** http(s) URL，在句末标点处截断 href，展示仍保留原匹配串 */
const URL_REGEX = /https?:\/\/[^\s<>"')}\]]+/gi;

const defaultLinkClass =
  "text-primary underline underline-offset-2 hover:opacity-90 wrap-break-word";

/**
 * 将纯文本中的 http(s) 链接转为 `<a target="_blank">`，其余原样输出。
 */
export function linkifyToReactNodes(
  text: string,
  options?: { linkClassName?: string }
): ReactNode {
  if (!text) return text;
  const nodes: ReactNode[] = [];
  let last = 0;
  const re = new RegExp(URL_REGEX.source, "gi");
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      nodes.push(<Fragment key={`t-${k++}`}>{text.slice(last, m.index)}</Fragment>);
    }
    const raw = m[0];
    const punctMatch = raw.match(/[.,;:!?*)\]'"]+$/);
    let href = raw;
    if (punctMatch) {
      href = raw.slice(0, -punctMatch[0].length);
    }
    if (href.length > 0) {
      nodes.push(
        <a
          key={`a-${k++}`}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(defaultLinkClass, options?.linkClassName)}
        >
          {raw}
        </a>
      );
    } else {
      nodes.push(<Fragment key={`t-${k++}`}>{raw}</Fragment>);
    }
    last = m.index + raw.length;
  }
  if (last < text.length) {
    nodes.push(<Fragment key={`t-${k++}`}>{text.slice(last)}</Fragment>);
  }
  return nodes.length > 0 ? nodes : text;
}
