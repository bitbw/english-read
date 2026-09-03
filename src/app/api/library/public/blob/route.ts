import { requireSessionApi } from "@/lib/api-session";
import { handleUploadPresigned, type HandleUploadPresignedBody } from "@vercel/blob/client";
import { issueSignedToken } from "@vercel/blob";
import { NextResponse } from "next/server";

const MAX_BYTES = 50 * 1024 * 1024;
const PUBLIC_PREFIX = "epubs/public/";

/**
 * 为客户端直传 Blob 签发 OIDC 预签名 URL（请求体不经由本路由承载文件，避免 Vercel 4.5MB 限制）。
 */
export async function POST(req: Request): Promise<NextResponse> {
  const authResult = await requireSessionApi();
  if ("error" in authResult) return authResult.error;

  const body = (await req.json()) as HandleUploadPresignedBody;

  try {
    const jsonResponse = await handleUploadPresigned({
      request: req,
      body,
      getSignedToken: async (pathname) => {
        if (!pathname.startsWith(PUBLIC_PREFIX)) {
          throw new Error(`Path must start with ${PUBLIC_PREFIX}`);
        }
        const token = await issueSignedToken({
          pathname,
          operations: ["put"],
          allowedContentTypes: ["application/epub+zip", "application/octet-stream"],
          maximumSizeInBytes: MAX_BYTES,
        });
        return { token };
      },
    });
    return NextResponse.json(jsonResponse);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Upload token failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
