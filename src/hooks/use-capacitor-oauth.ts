"use client";

import { useCallback, useEffect, useRef } from "react";
import { isCapacitor } from "@/lib/is-capacitor";

const BRIDGE_SCHEME_PREFIX = "com.englishread.app://oauth-bridge";

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
 * 新版流程：
 * 1. 自定义 scheme（com.englishread.app://oauth-bridge）的深链接传回 App
 * 2. 提取桥接令牌，调用 /api/mobile-bridge/consume 换取 session cookie
 * 3. 关闭 Custom Tab 并导航到目标页面
 */
export function useCapacitorOAuth() {
  const processingRef = useRef(false);

  const handleDeepLink = useCallback((url: string) => {
    if (processingRef.current) return;
    if (!url.startsWith(BRIDGE_SCHEME_PREFIX)) return;

    processingRef.current = true;

    const parsed = new URL(url);
    const token = parsed.searchParams.get("token");
    const next = parsed.searchParams.get("next") ?? "/dashboard";

    if (!token) {
      window.location.href = "/error";
      return;
    }

    // 立即导航到中转页（显示 loading），由中转页完成 bridge consume
    sessionStorage.setItem("oauthBridgeToken", token);
    sessionStorage.setItem("oauthBridgeNext", next);
    window.location.href = "/mobile-oauth-redirect?bridging=true";
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