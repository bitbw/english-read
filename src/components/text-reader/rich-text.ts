const ALLOWED_TAGS = new Set([
  "a", "b", "blockquote", "br", "caption", "code", "del", "div", "em", "h1", "h2", "h3", "h4", "h5", "h6",
  "hr", "i", "li", "ol", "p", "pre", "s", "span", "strong", "sub", "sup", "table", "tbody", "td", "th", "thead", "tr", "u", "ul",
]);

const DROP_CONTENT_TAGS = new Set(["iframe", "object", "script", "style", "svg", "template"]);
const BLOCK_TAGS = new Set(["blockquote", "div", "h1", "h2", "h3", "h4", "h5", "h6", "li", "p", "pre", "tr"]);
const ALLOWED_STYLES = new Set([
  "background", "background-color", "border", "border-bottom", "border-collapse", "border-left", "border-right", "border-spacing", "border-top", "color", "direction",
  "font-family", "font-size", "font-style", "font-variant", "font-weight", "height", "letter-spacing", "line-height", "list-style", "list-style-type", "margin",
  "margin-bottom", "margin-left", "margin-right", "margin-top", "max-height", "max-width", "min-height", "min-width", "padding", "padding-bottom", "padding-left",
  "padding-right", "padding-top", "text-align", "text-decoration", "text-indent", "text-transform", "vertical-align", "white-space", "width", "word-spacing",
]);

function escapeAttribute(value: string) {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const escapeText = escapeAttribute;

function safeStyleValue(value: string) {
  return value.length <= 200 && !/(url|expression|javascript|@import|[<>])/i.test(value);
}

function sanitizeElement(element: Element): string {
  const tag = element.tagName.toLowerCase();
  if (DROP_CONTENT_TAGS.has(tag)) return "";

  const children = Array.from(element.childNodes)
    .map((child) => child.nodeType === Node.ELEMENT_NODE
      ? sanitizeElement(child as Element)
      : child.nodeType === Node.TEXT_NODE
        ? escapeText(child.textContent ?? "")
        : "")
    .join("");

  if (!ALLOWED_TAGS.has(tag)) return children;

  const attributes: string[] = [];
  const styles: string[] = [];
  for (const attribute of Array.from(element.attributes)) {
    const name = attribute.name.toLowerCase();
    const value = attribute.value.trim();
    if (name === "style") {
      const style = (element as HTMLElement).style;
      for (let index = 0; index < style.length; index++) {
        const property = style.item(index);
        const normalizedValue = style.getPropertyValue(property).trim();
        if (ALLOWED_STYLES.has(property) && safeStyleValue(normalizedValue)) {
          styles.push(`${property}: ${normalizedValue}`);
        }
      }
    } else if (tag === "a" && name === "href" && /^(https?:|mailto:)/i.test(value)) {
      attributes.push(`href="${escapeAttribute(value)}"`);
    } else if ((tag === "a" || tag === "td" || tag === "th" || tag === "ol") && ["title", "colspan", "rowspan", "start"].includes(name) && /^[\w\s.,-]{1,100}$/.test(value)) {
      attributes.push(`${name}="${escapeAttribute(value)}"`);
    }
  }
  if (styles.length) attributes.push(`style="${escapeAttribute(styles.join("; "))}"`);
  const attrs = attributes.length ? ` ${attributes.join(" ")}` : "";
  return tag === "br" || tag === "hr" ? `<${tag}${attrs}>` : `<${tag}${attrs}>${children}</${tag}>`;
}

export function sanitizeRichText(html: string) {
  if (typeof DOMParser === "undefined") {
    return html.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  const document = new DOMParser().parseFromString(html, "text/html");
  return Array.from(document.body.childNodes)
    .map((node) => node.nodeType === Node.ELEMENT_NODE
      ? sanitizeElement(node as Element)
      : node.nodeType === Node.TEXT_NODE
        ? escapeText(node.textContent ?? "")
        : "")
    .join("");
}

export function plainTextToHtml(text: string) {
  const escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return escaped.split(/\n{2,}/).map((paragraph) => `<p>${paragraph.replace(/\n/g, "<br>")}</p>`).join("");
}

export function richTextToPlainText(html: string) {
  if (typeof DOMParser === "undefined") return html.replace(/<[^>]*>/g, " ");
  const document = new DOMParser().parseFromString(html, "text/html");
  function read(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
    if (node.nodeType !== Node.ELEMENT_NODE && node.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) return "";
    const element = node as Element;
    if (element.tagName.toLowerCase() === "br") return "\n";
    const text = Array.from(node.childNodes).map(read).join("");
    return BLOCK_TAGS.has(element.tagName.toLowerCase()) ? `\n${text}\n` : text;
  }
  return read(document.body).replace(/\n{3,}/g, "\n\n").trim();
}
