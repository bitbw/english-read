import { list } from "@vercel/blob";
import { NextResponse } from "next/server";

export type ApkItem = {
  name: string;
  url: string;
  size: number;
  sizeLabel: string;
  uploadedAt: string;
};

export type ApkListResponse = {
  apks: ApkItem[];
  latest: ApkItem | null;
};

// GET /api/apk/list — 列出 Vercel Blob 中所有 EnglishRead 开头的 APK
export async function GET() {
  try {
    const { blobs } = await list({ prefix: "apks/" });

    const apks = blobs
      .filter((b) => {
        const name = b.pathname.split("/").pop() ?? "";
        return name.startsWith("EnglishRead") && name.endsWith(".apk");
      })
      .map((b) => {
        const name = b.pathname.split("/").pop() ?? "";
        return {
          name,
          url: b.url,
          size: b.size,
          sizeLabel: formatSize(b.size),
          uploadedAt: b.uploadedAt instanceof Date ? b.uploadedAt.toISOString() : String(b.uploadedAt),
        };
      })
      .sort(
        (a, b) =>
          new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime(),
      );

    return NextResponse.json({ apks, latest: apks[0] ?? null } satisfies ApkListResponse);
  } catch (error) {
    console.error("[BOWEN_LOG] Failed to list APKs:", error);
    return NextResponse.json(
      { error: "Failed to list APKs" },
      { status: 500 },
    );
  }
}

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) {
    return (bytes / (1024 * 1024 * 1024)).toFixed(1) + " GB";
  }
  if (bytes >= 1024 * 1024) {
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  }
  if (bytes >= 1024) {
    return (bytes / 1024).toFixed(0) + " KB";
  }
  return bytes + " B";
}