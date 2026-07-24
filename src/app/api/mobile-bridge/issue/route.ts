import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  createBridgeToken,
  isSafeNextPath,
} from "@/lib/mobile-bridge";

export const dynamic = "force-dynamic";

/**
 * 在 Custom Tab 内、OAuth 回调成功后由 auth.js 重定向至此。
 * 验证 session → 签发桥接令牌 → 用自定义 scheme 唤起 App。
 */
export async function GET( req: Request ) {
  const session = await auth();
  if ( !session?.user?.id ) {
    redirect( "/error" );
  }

  const { searchParams } = new URL( req.url );
  const next = isSafeNextPath( searchParams.get( "next" ) );
  const token = createBridgeToken( session.user.id );

  const redirectUrl = `com.englishread.app://oauth-bridge?token=${encodeURIComponent( token )}&next=${encodeURIComponent( next )}`;
  return NextResponse.redirect( redirectUrl );
}