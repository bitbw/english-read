import { Capacitor } from "@capacitor/core";

/**
 * 检测当前是否运行在 Capacitor 原生壳内（而非浏览器/PWA）
 * 在 Server Component 中始终返回 false
 */
export function isCapacitor(): boolean {
  if (typeof window === "undefined") return false;
  return Capacitor.isNativePlatform();
}

/**
 * 获取当前运行平台：'ios' | 'android' | 'web'
 */
export function getCapacitorPlatform(): string {
  if (typeof window === "undefined") return "web";
  return Capacitor.getPlatform();
}