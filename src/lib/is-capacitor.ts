/**
 * 检测当前是否运行在 Capacitor App 内（而非浏览器）
 * 在 Server Component 中始终返回 false
 */
export function isCapacitor(): boolean {
  if (typeof window === "undefined") return false;
  return typeof (window as unknown as Record<string, unknown>).Capacitor !== "undefined";
}