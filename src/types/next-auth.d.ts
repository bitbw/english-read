import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    /** E.164 或历史 11 位国内号，手机验证码登录时设置 */
    phone?: string | null;
    /** 角色：user（普通用户）| admin（管理员） */
    role?: "user" | "admin";
  }
  interface Session {
    user: {
      id: string;
      /** 与 email 二选一，手机登录用户有值 */
      phone?: string | null;
      /** 角色：user（普通用户）| admin（管理员） */
      role: "user" | "admin";
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    phone?: string | null;
    /** 角色：user（普通用户）| admin（管理员） */
    role?: "user" | "admin";
  }
}
