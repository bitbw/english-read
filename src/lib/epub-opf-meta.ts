import JSZip from "jszip";

function firstCapture(pattern: RegExp, s: string): string {
  const m = s.match(pattern);
  return m?.[1]?.trim() ?? "";
}

/**
 * 从 EPUB（ZIP）缓冲区解析 dc:title 与首个 dc:creator（服务端，无 epubjs/DOM）。
 */
export async function parseEpubOpfMeta(buffer: ArrayBuffer): Promise<{
  title: string;
  author: string;
}> {
  const zip = await JSZip.loadAsync(buffer);
  const containerEntry = zip.file("META-INF/container.xml");
  if (!containerEntry) {
    return { title: "", author: "" };
  }
  const containerXml = await containerEntry.async("string");
  const opfPath = firstCapture(/full-path\s*=\s*["']([^"']+\.opf)["']/i, containerXml);
  if (!opfPath) {
    return { title: "", author: "" };
  }
  const normalized = opfPath.replace(/^\/+/, "");
  const opfEntry = zip.file(normalized);
  if (!opfEntry) {
    return { title: "", author: "" };
  }
  const opfXml = await opfEntry.async("string");

  let title =
    firstCapture(/<dc:title[^>]*>([^<]*)<\/dc:title>/i, opfXml) ||
    firstCapture(/<title[^>]*>([^<]*)<\/title>/i, opfXml);
  if (!title) {
    title = firstCapture(
      /<meta\s+[^>]*name\s*=\s*["']title["'][^>]*content\s*=\s*["']([^"']*)["']/i,
      opfXml
    );
  }

  const author =
    firstCapture(/<dc:creator[^>]*>([^<]*)<\/dc:creator>/i, opfXml) ||
    firstCapture(/<creator[^>]*>([^<]*)<\/creator>/i, opfXml);

  return { title, author };
}
