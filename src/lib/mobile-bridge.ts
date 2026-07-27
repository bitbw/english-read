import crypto from "node:crypto";

const BRIDGE_TTL_MS = 60_000;

function base64url( buf: Buffer ): string {
  return buf
    .toString( "base64" )
    .replace( /\+/g, "-" )
    .replace( /\//g, "_" )
    .replace( /=+$/, "" );
}

/**
 * 签发一个 60 秒有效、HMAC-SHA256 签名的无状态桥接令牌。
 * 格式：`base64url(payload).base64url(signature)`
 * payload = `${userId}.${expiresAtMs}`
 */
export function createBridgeToken( userId: string ): string {
  const expiresAtMs = Date.now() + BRIDGE_TTL_MS;
  const payload = `${userId}.${expiresAtMs}`;
  const hmac = crypto.createHmac( "sha256", process.env.AUTH_SECRET! );
  hmac.update( payload );
  const signature = base64url( hmac.digest() );
  return `${base64url( Buffer.from( payload, "utf-8" ) )}.${signature}`;
}

/**
 * 校验桥接令牌：签名 + 过期时间，常量时间比较防止时序攻击。
 * 成功返回 `{ userId }`，失败返回 `null`。
 */
export function verifyBridgeToken(
  token: string,
): { userId: string } | null {
  const dotIdx = token.lastIndexOf( "." );
  if ( dotIdx === -1 ) return null;

  const rawPayload = token.slice( 0, dotIdx );
  const rawSig = token.slice( dotIdx + 1 );
  if ( !rawPayload || !rawSig ) return null;

  let payloadStr: string;
  try {
    payloadStr = Buffer.from( rawPayload, "base64url" ).toString( "utf-8" );
  } catch {
    return null;
  }

  const sepIdx = payloadStr.lastIndexOf( "." );
  if ( sepIdx === -1 ) return null;
  const userId = payloadStr.slice( 0, sepIdx );
  const expiresAtMs = Number( payloadStr.slice( sepIdx + 1 ) );
  if ( !userId || !Number.isFinite( expiresAtMs ) ) return null;
  if ( Date.now() > expiresAtMs ) return null;

  // 常量时间比对签名
  const hmac = crypto.createHmac( "sha256", process.env.AUTH_SECRET! );
  hmac.update( payloadStr );
  const expectedSig = base64url( hmac.digest() );

  try {
    if (
      !crypto.timingSafeEqual(
        Buffer.from( rawSig, "ascii" ),
        Buffer.from( expectedSig, "ascii" ),
      )
    ) {
      return null;
    }
  } catch {
    return null;
  }

  return { userId };
}

/**
 * 安全的 `next` 路径校验。
 * 只允许以单个 `/` 开头且不是 `//` 的相对路径，防止开放重定向。
 */
export function isSafeNextPath( next: string | null ): string {
  if ( typeof next === "string" && /^\/(?!\/)/.test( next ) ) return next;
  return "/dashboard";
}

/**
 * 返回与 `@auth/core` 默认 cookies 一致的 session cookie 名称。
 * @see https://github.com/nextauthjs/next-auth/blob/main/packages/core/src/lib/utils/cookie.ts
 */
export function getSessionCookieName( secure: boolean ): string {
  return `${secure ? "__Secure-" : ""}authjs.session-token`;
}