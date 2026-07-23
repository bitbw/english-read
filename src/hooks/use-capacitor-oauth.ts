"use client";

import { useCallback, useEffect, useRef } from "react";
import { isCapacitor } from "@/lib/is-capacitor";

const AUTH_CALLBACK_PREFIX = "/api/auth/callback/";

/**
 * 在 Capacitor App 内用系统内嵌浏览器（Chrome Custom Tabs / SFSafariViewController）
 * 打开 OAuth 授权页。Google 会阻止在原生 WebView 内完成 OAuth，
 * Custom Tabs 是唯一能同时满足"看起来像在 App 内"且被 Google 允许的方式。
 */
export async function openOAuthUrl(url: string): Promise<void> {
  const { Browser } = await import("@capacitor/browser");
  await Browser.open({ url });
}

/**
 * Capacitor OAuth Deep Link 处理 Hook
 *
 * 当 Android App Link 将 OAuth 回调 URL 传回 App 时，
 * 关闭内嵌浏览器并导航 WebView 到该 URL 以完成 OAuth 流程（设置 session cookie）
 */
export function useCapacitorOAuth() {
  const processingRef = useRef(false);

  const handleDeepLink = useCallback((url: string) => {
    if (processingRef.current) return;
    if (!url.includes(AUTH_CALLBACK_PREFIX)) return;

    processingRef.current = true;
    import("@capacitor/browser")
      .then(({ Browser }) => Browser.close())
      .catch(() => {})
      .finally(() => {
        // 导航到回调 URL，让 next-auth 处理 code 交换和 session 设置
        window.location.href = url;
      });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isCapacitor()) return;

    import("@capacitor/app")
      .then(({ App }) => {
        App.addListener("appUrlOpen", (data) => {
          handleDeepLink(data.url);
        });
      })
      .catch(() => {
        // @capacitor/app not installed or import error
      });
  }, [handleDeepLink]);
}