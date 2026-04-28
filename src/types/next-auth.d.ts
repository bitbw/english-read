import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    /** E.164 或历史 11 位国内号，手机验证码登录时设置 */
    phone?: string | null;
  }
  interface Session {
    user: {
      id: string;
      /** 与 email 二选一，手机登录用户有值 */
      phone?: string | null;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    phone?: string | null;
  }
}
