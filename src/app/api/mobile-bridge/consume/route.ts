import { encode } from "next-auth/jwt";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import {
  getSessionCookieName,
  verifyBridgeToken,
} from "@/lib/mobile-bridge";

export const dynamic = "force-dynamic";

const consumeSchema = z.object( {
  token: z.string().min( 1 ),
} );

/**
 * App WebView 发起 fetch 调用，拿桥接令牌换取真正的 session JWT cookie。
 * Set-Cookie 会写进 WebView 自己的 cookie 仓库。
 */
export async function POST( req: NextRequest ) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json( { error: "无效的 JSON" }, { status: 400 } );
  }

  const parsed = consumeSchema.safeParse( body );
  if ( !parsed.success ) {
    return NextResponse.json( { error: "参数无效" }, { status: 400 } );
  }

  const { userId } = verifyBridgeToken( parsed.data.token ) ?? {};
  if ( !userId ) {
    return NextResponse.json( { error: "令牌无效或已过期" }, { status: 400 } );
  }

  const [row] = await db
    .select( {
      id: users.id,
      email: users.email,
      name: users.name,
      image: users.image,
      phone: users.phone,
      role: users.role,
    } )
    .from( users )
    .where( eq( users.id, userId ) )
    .limit( 1 );

  if ( !row ) {
    return NextResponse.json( { error: "用户不存在" }, { status: 400 } );
  }

  const maxAge = 30 * 24 * 60 * 60;
  const secure =
    req.nextUrl?.protocol === "https:" ||
    req.url.startsWith( "https" );
  const cookieName = getSessionCookieName( secure );

  const encoded = await encode( {
    secret: process.env.AUTH_SECRET!,
    salt: cookieName,
    maxAge,
    token: {
      sub: row.id,
      email: row.email,
      name: row.name,
      picture: row.image,
      phone: row.phone,
      role: row.role,
    },
  } );

  const res = NextResponse.json( { ok: true } );
  res.cookies.set( cookieName, encoded, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge,
  } );

  return res;
}