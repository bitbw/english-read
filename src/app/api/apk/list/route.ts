import { NextResponse } from "next/server";
import APP_VERSION from "@/lib/version";

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

const BLOB_BASE = "https://bpjalfnicj8nnzo2.public.blob.vercel-storage.com";

// GET /api/apk/list — 返回硬编码的 APK 下载信息（基于当前 APP_VERSION）
export async function GET() {
  const name = `EnglishRead-v${APP_VERSION}-release.apk`;
  const url = `${BLOB_BASE}/apks/${name}`;
  const sizeLabel = "~35 MB";

  const item: ApkItem = {
    name,
    url,
    size: 0,
    sizeLabel,
    uploadedAt: new Date().toISOString(),
  };

  return NextResponse.json({ apks: [item], latest: item } satisfies ApkListResponse);
}