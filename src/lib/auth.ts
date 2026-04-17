import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, accounts, sessions, verificationTokens } from "@/lib/db/schema";

/**
 * `useSession().update(payload)` 会通过 POST /session 传入 `session`；JWT 里头像字段为 `picture`。
 * 需在 DB 刷新之后合并，以便与接口返回一致并覆盖可能的读延迟。
 */
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
  ],
  callbacks: {
    async jwt({ token, user, trigger, session: clientSession }) {
      if (user) {
        token.sub = user.id ?? token.sub;
        token.email = user.email;
        token.name = user.name;
        token.picture = user.image;
      }
      if (trigger === "update" && token.sub) {
        const [row] = await db
          .select({
            name: users.name,
            email: users.email,
            image: users.image,
          })
          .from(users)
          .where(eq(users.id, token.sub as string))
          .limit(1);
        if (row) {
          token.name = row.name;
          token.email = row.email;
          token.picture = row.image;
        }
        mergeClientSessionIntoJwt(token, clientSession);
      }
      return token;
    },
    session({ session, token }) {
      if (token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/error",
  },
});
