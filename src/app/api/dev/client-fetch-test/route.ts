import { NextResponse } from "next/server";

/**
 * 仅供本地 development：配合 /dev/client-fetch-test 验证 clientFetch 的 toast / 静默行为。
 */
export async function GET(req: Request) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { searchParams } = new URL(req.url);
  const kind = searchParams.get("kind");

  if (kind === "401") {
    return NextResponse.json({ error: "测试 401（需登录或权限）" }, { status: 401 });
  }
  if (kind === "404") {
    return NextResponse.json({ error: "测试 404" }, { status: 404 });
  }

  return NextResponse.json({ error: "测试 500（服务端错误）" }, { status: 500 });
}
