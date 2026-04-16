import { auth } from "@/lib/auth";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";

const MAX_BYTES = 50 * 1024 * 1024;
const PUBLIC_PREFIX = "epubs/public/";

/**
 * 为客户端直传 Blob 签发 token（请求体不经由本路由承载文件，避免 Vercel 4.5MB 限制）。
 */
export async function POST(req: Request): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      request: req,
      body,
      onBeforeGenerateToken: async (pathname) => {
        if (!pathname.startsWith(PUBLIC_PREFIX)) {
          throw new Error(`Path must start with ${PUBLIC_PREFIX}`);
        }
        return {
          allowedContentTypes: ["application/epub+zip", "application/octet-stream"],
          maximumSizeInBytes: MAX_BYTES,
          addRandomSuffix: false,
        };
      },
    });
    return NextResponse.json(jsonResponse);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Upload token failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
