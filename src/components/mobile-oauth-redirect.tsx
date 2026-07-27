"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { signIn } from "next-auth/react";

const PROVIDER_LABELS: Record<string, string> = {
  github: "GitHub",
  google: "Google",
};

export function MobileOAuthRedirect() {
  const params = useSearchParams();
  const [status, setStatus] = useState<"redirecting" | "done">("redirecting");
  const [label, setLabel] = useState("");

  useEffect(() => {
    if (status !== "redirecting") return;
    setStatus("done");

    // 模式 A: provider 参数 — 启动 OAuth signIn
    const provider = params.get("provider");
    if (provider === "google" || provider === "github") {
      setLabel(PROVIDER_LABELS[provider]);
      void signIn(provider, {
        callbackUrl: `/api/mobile-bridge/issue?next=${encodeURIComponent("/dashboard")}`,
      });
      return;
    }

    // 模式 B: bridging 参数 — 消费 bridge token，设置 session
    if (params.get("bridging") === "true") {
      setLabel("");
      const token = sessionStorage.getItem("oauthBridgeToken");
      const next = sessionStorage.getItem("oauthBridgeNext") ?? "/dashboard";
      sessionStorage.removeItem("oauthBridgeToken");
      sessionStorage.removeItem("oauthBridgeNext");

      if (!token) {
        window.location.href = "/error";
        return;
      }

      void (async () => {
        try {
          const res = await fetch("/api/mobile-bridge/consume", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token }),
          });
          if (res.ok) {
            const { Browser } = await import("@capacitor/browser");
            await Browser.close().catch(() => {});
            window.location.href = next;
            return;
          }
        } catch {
          // fallthrough to error
        }
        window.location.href = "/error";
      })();
      return;
    }

    // 未知参数，回退到登录页
    window.location.href = "/login";
  }, [params, status]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden />
      <p className="text-center text-sm text-muted-foreground">
        {label ? (
          <>正在跳转到 {label}...</>
        ) : (
          <>正在跳转...</>
        )}
      </p>
    </div>
  );
}