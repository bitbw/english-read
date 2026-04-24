import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import bcrypt from "bcryptjs";
import { eq, or } from "drizzle-orm";
import { verifySmsCode } from "@/lib/aliyun-dypns";
import { db } from "@/lib/db";
import { users, accounts, sessions, verificationTokens } from "@/lib/db/schema";
import {
  maskPhoneForDisplay,
  parsePhoneOtpPayload,
} from "@/lib/phone-auth";

/**
 * `useSession().update(payload)` 会通过 POST /session 传入 `session`；JWT 里头像字段为 `picture`。
 * 需在 DB 刷新之后合并，以便与接口返回一致并覆盖可能的读延迟。
 */
function phoneMatchWhere(
  e164: string,
  /** 仅中国大陆：历史数据可能为 11 位无 +86 */
  legacy11For86: string | null,
) {
  if (legacy11For86) {
    return or(eq(users.phone, e164), eq(users.phone, legacy11For86));
  }
  return eq(users.phone, e164);
}

/** 新用户存 E.164（+区号+国内号码）；老用户可能为 11 位国内号 */
async function findOrCreateUserByPhoneE164(
  e164: string,
  legacy11For86: string | null,
) {
  const [existing] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      image: users.image,
      phone: users.phone,
    })
    .from(users)
    .where(phoneMatchWhere(e164, legacy11For86))
    .limit(1);
  if (existing) return existing;

  const defaultName = e164.startsWith("+86")
    ? `手机用户 ${maskPhoneForDisplay(e164)}`
    : `User ${maskPhoneForDisplay(e164)}`;
  try {
    const [created] = await db
      .insert(users)
      .values({
        name: defaultName,
        phone: e164,
        email: null,
      })
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        image: users.image,
        phone: users.phone,
      });
    return created;
  } catch (e: unknown) {
    const err = e as { code?: string };
    if (err.code === "23505") {
      const [again] = await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          image: users.image,
          phone: users.phone,
        })
        .from(users)
        .where(phoneMatchWhere(e164, legacy11For86))
        .limit(1);
      if (again) return again;
    }
    throw e;
  }
}

function mergeClientSessionIntoJwt(
  token: { name?: unknown; email?: unknown; picture?: unknown },
  raw: unknown,
) {
  if (raw === null || raw === undefined || typeof raw !== "object") return;
  const o = raw as Record<string, unknown>;
  const inner =
    "user" in o && o.user !== null && typeof o.user === "object"
      ? (o.user as Record<string, unknown>)
      : null;
  const pick = (key: "name" | "email" | "image") =>
    key in o ? o[key] : inner && key in inner ? inner[key] : undefined;
  if ("name" in o || (inner && "name" in inner)) {
    token.name = pick("name") as string | null | undefined;
  }
  if ("email" in o || (inner && "email" in inner)) {
    token.email = pick("email") as string | null | undefined;
  }
  if ("image" in o || (inner && "image" in inner)) {
    token.picture = pick("image") as string | null | undefined;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  // Credentials 登录在 Auth.js 中只会写入 JWT cookie；若保留默认 `database` 策略，
  // `auth()` 会把该 cookie 当作 DB sessionToken 查询，导致永远无会话、API 401。
  // 统一为 JWT 后，OAuth 与邮箱密码共用同一套会话逻辑。
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
  },
  providers: [
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      allowDangerousEmailAccountLinking: true,
    }),
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      allowDangerousEmailAccountLinking: true,
    }),
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const rawEmail = credentials?.email;
        const rawPassword = credentials?.password;
        if (typeof rawEmail !== "string" || typeof rawPassword !== "string") {
          return null;
        }
        const email = rawEmail.toLowerCase().trim();
        const password = rawPassword;
        if (!email || !password) return null;

        const [user] = await db
          .select({
            id: users.id,
            email: users.email,
            name: users.name,
            image: users.image,
            passwordHash: users.passwordHash,
          })
          .from(users)
          .where(eq(users.email, email))
          .limit(1);

        if (!user?.passwordHash || !user.email) return null;
        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      },
    }),
    Credentials({
      id: "phone-otp",
      name: "phone-otp",
      credentials: {
        countryCode: { label: "Country", type: "text" },
        phone: { label: "Phone", type: "text" },
        code: { label: "Code", type: "text" },
      },
      async authorize(credentials) {
        const rawCc = credentials?.countryCode;
        const rawPhone = credentials?.phone;
        const rawCode = credentials?.code;
        if (typeof rawCode !== "string") {
          return null;
        }
        const parsed = parsePhoneOtpPayload(rawCc, rawPhone);
        const code = rawCode.trim();
        if (!parsed || !code) return null;
        if (
          !(await verifySmsCode(
            parsed.localDigits,
            parsed.countryCode,
            code,
          ))
        ) {
          return null;
        }

        const legacy11 =
          parsed.countryCode === "86" && parsed.localDigits.length === 11
            ? parsed.localDigits
            : null;
        const row = await findOrCreateUserByPhoneE164(parsed.e164, legacy11);
        if (!row) return null;

        return {
          id: row.id,
          email: row.email,
          name: row.name,
          image: row.image,
          phone: row.phone,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session: clientSession }) {
      if (user) {
        token.sub = user.id ?? token.sub;
        token.email = user.email ?? undefined;
        token.name = user.name;
        token.picture = user.image;
        token.phone = user.phone ?? null;
      }
      if (trigger === "update" && token.sub) {
        const [row] = await db
          .select({
            name: users.name,
            email: users.email,
            image: users.image,
            phone: users.phone,
          })
          .from(users)
          .where(eq(users.id, token.sub as string))
          .limit(1);
        if (row) {
          token.name = row.name;
          token.email = row.email;
          token.picture = row.image;
          token.phone = row.phone;
        }
        mergeClientSessionIntoJwt(token, clientSession);
      }
      return token;
    },
    session({ session, token }) {
      if (token.sub) {
        session.user.id = token.sub;
      }
      session.user.phone = (token.phone as string | null | undefined) ?? null;
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/error",
  },
});
