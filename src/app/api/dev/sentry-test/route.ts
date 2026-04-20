import * as Sentry from "@sentry/nextjs";
import { NextResponse } from "next/server";

/**
 * 仅 development：用于验证 Node 服务端 Sentry 上报。
 * - GET /api/dev/sentry-test          → captureException
 * - GET /api/dev/sentry-test?throw=1  → 抛错（由 Next + Sentry 捕获）
 */
export async function GET(request: Request) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  if (searchParams.get("throw") === "1") {
    throw new Error("Sentry server route uncaught test (english-read dev)");
  }

  Sentry.captureException(
    new Error("Sentry server captureException test (english-read dev)"),
  );
  return NextResponse.json({ ok: true, mode: "captureException" });
}
