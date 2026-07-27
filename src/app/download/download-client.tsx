"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BackButton } from "@/components/back-button";
import { clientFetch } from "@/lib/client-fetch";
import { isCapacitor } from "@/lib/is-capacitor";
import {
  Download,
  Smartphone,
  Apple,
  ChevronDown,
  ChevronUp,
  Clock,
  FileDown,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ApkListResponse } from "@/app/api/apk/list/route";

export function DownloadPageClient() {
  const [data, setData] = useState<ApkListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await clientFetch("/api/apk/list", { showErrorToast: false });
      if (r.ok) {
        const json = (await r.json()) as ApkListResponse;
        setData(json);
      } else {
        setData({ apks: [], latest: null });
      }
    } catch {
      setData({ apks: [], latest: null });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // 首次渲染保持和服务端一致（false），挂载后再切换，避免 hydration mismatch
  const [inApp, setInApp] = useState(false);

  useEffect(() => {
    setInApp(isCapacitor());
  }, []);

  if (inApp) {
    return (
      <div className="p-6">
        <div className="mx-auto flex max-w-md flex-col items-center justify-center py-20 text-center">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
            <CheckCircle2 className="h-10 w-10 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">App Installed</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            You are already running English Read on this device.
          </p>
        </div>
      </div>
    );
  }

  const canShowMore = data && data.apks.length > 1;

  return (
    <div className="p-6">
      <div className="mx-auto max-w-3xl space-y-6">
        {/* 顶部标题 + 返回按钮 */}
        <div className="flex items-center gap-3">
          <BackButton fallbackHref="/dashboard" />
          <div>
            <h1 className="text-2xl font-bold">Download App</h1>
            <p className="text-sm text-muted-foreground">
              Choose your platform to get started
            </p>
          </div>
        </div>

        {loading ? (
          <div className="grid gap-6 sm:grid-cols-2">
            {[1, 2].map((i) => (
              <Card key={i}>
                <CardContent className="flex animate-pulse flex-col items-center gap-4 py-12">
                  <div className="h-16 w-16 rounded-2xl bg-muted" />
                  <div className="h-5 w-24 rounded bg-muted" />
                  <div className="h-4 w-32 rounded bg-muted" />
                  <div className="h-10 w-36 rounded bg-muted" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2">
          {/* ──────────── Android ──────────── */}
          <Card
            className={cn(
              "relative overflow-hidden border-2 transition-all duration-300",
              data && data.apks.length > 0
                ? "border-green-500/30 shadow-lg shadow-green-500/5"
                : "border-border",
            )}
          >
            {data && data.apks.length > 0 && (
              <div className="absolute right-0 top-0 rounded-bl-lg bg-green-500 px-3 py-1 text-xs font-medium text-white">
                Available
              </div>
            )}
            <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 shadow-lg shadow-green-500/20">
                <Smartphone className="h-8 w-8 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Android</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  APK file &middot; Sideload ready
                </p>
              </div>

              {data && data.apks.length > 0 && data.latest ? (
                <div className="w-full space-y-3">
                  <Button
                    size="lg"
                    className="w-full gap-2 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 shadow-lg shadow-green-500/20"
                    onClick={() => window.open(data.latest!.url, "_blank")}
                  >
                    <Download className="h-4 w-4" />
                    Download {data.latest.sizeLabel}
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    {data.latest.name}
                  </p>

                  {canShowMore && (
                    <div className="space-y-2">
                      <button
                        type="button"
                        onClick={() => setShowAll(!showAll)}
                        className="flex w-full items-center justify-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
                      >
                        <Clock className="h-3 w-3" />
                        {showAll ? (
                          <>
                            <ChevronUp className="h-3 w-3" />
                            Hide old versions
                          </>
                        ) : (
                          <>
                            <ChevronDown className="h-3 w-3" />
                            {data.apks.length - 1} older version
                            {data.apks.length > 2 ? "s" : ""}
                          </>
                        )}
                      </button>

                      {showAll && (
                        <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-border p-1">
                          {data.apks.map((apk) => (
                            <div
                              key={apk.name}
                              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors hover:bg-muted"
                            >
                              <FileDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                              <span className="flex-1 truncate text-left">
                                {apk.name}
                              </span>
                              <span className="shrink-0 text-muted-foreground">
                                {apk.sizeLabel}
                              </span>
                              <button
                                type="button"
                                className="shrink-0 text-foreground underline underline-offset-2"
                                onClick={() => window.open(apk.url, "_blank")}
                              >
                                Download
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No builds available yet
                </p>
              )}
            </CardContent>
          </Card>

          {/* ──────────── iOS ──────────── */}
          <Card className="border-2 border-border/50 bg-muted/20">
            <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-gray-500 to-gray-600 shadow-lg shadow-gray-500/10">
                <Apple className="h-8 w-8 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold">iOS</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  iPhone &middot; iPad
                </p>
              </div>
              <div className="flex flex-col items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                  <Clock className="h-3 w-3" />
                  Coming Soon
                </span>
                <p className="text-xs text-muted-foreground">
                  iOS support is not available yet.
                </p>
                <p className="text-xs text-muted-foreground">
                  Stay tuned for future updates.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
        </div>
      </div>
    );
}