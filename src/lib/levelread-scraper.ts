export function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(parseInt(n, 10)));
}

export function extractArticleContent(html: string): string {
  const audioIndex = html.search(/>\s*Audio\s*</i);
  const articleHtml = audioIndex > 0 ? html.slice(0, audioIndex) : html;
  const paragraphs: string[] = [];
  const paragraphStarts = /<div\b(?=[^>]*\bdata-audio-paragraph-start=)[^>]*>/gi;
  const divTags = /<\/?div\b[^>]*>/gi;
  while (paragraphStarts.exec(articleHtml) !== null) {
    divTags.lastIndex = paragraphStarts.lastIndex;
    let depth = 1;
    let paragraphEnd = -1;
    let divTag: RegExpExecArray | null;

    while ((divTag = divTags.exec(articleHtml)) !== null) {
      if (divTag[0][1] === "/") {
        depth--;
        if (depth === 0) {
          paragraphEnd = divTag.index;
          break;
        }
      } else {
        depth++;
      }
    }

    if (paragraphEnd === -1) continue;

    const text = decodeHtmlEntities(
      articleHtml
        .slice(paragraphStarts.lastIndex, paragraphEnd)
        .replace(/<[^>]+>/g, "")
        .replace(/\s+/g, " ")
        .trim()
    );
    if (text.length > 20 && /[a-zA-Z]{3,}/.test(text) && /[.!?]/.test(text)) {
      paragraphs.push(text);
    }
    paragraphStarts.lastIndex = divTags.lastIndex;
  }

  return paragraphs.slice(0, 15).join("\n\n");
}

export function parsePublishedDate(html: string): Date | null {
  const numericDate = html.match(/(\d{4})\/(\d{2})\/(\d{2})/);
  if (numericDate) {
    const date = new Date(`${numericDate[1]}-${numericDate[2]}-${numericDate[3]}`);
    return isNaN(date.getTime()) ? null : date;
  }

  const englishDate = html.match(
    /(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s*(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),\s*(\d{4})/i
  );
  if (!englishDate) return null;

  const month = [
    "january", "february", "march", "april", "may", "june",
    "july", "august", "september", "october", "november", "december",
  ].indexOf(englishDate[1].toLowerCase());
  const date = new Date(Date.UTC(Number(englishDate[3]), month, Number(englishDate[2])));
  return date.getUTCMonth() === month && date.getUTCDate() === Number(englishDate[2])
    ? date
    : null;
}
