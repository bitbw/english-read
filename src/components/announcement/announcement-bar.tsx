"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { clientFetch } from "@/lib/client-fetch";
import { XIcon, InfoIcon, ExternalLinkIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AnnouncementItem } from "@/app/api/announcements/route";

const LS_PREFIX = "announcement_closed_";
const LS_TTL = 24 * 60 * 60 * 1000;

function isDismissed(id: string): boolean {
  try {
    const raw = localStorage.getItem(`${LS_PREFIX}${id}`);
    if (!raw) return false;
    const stored = JSON.parse(raw) as { ts: number };
    return Date.now() - stored.ts < LS_TTL;
  } catch {
    return false;
  }
}

function dismiss(id: string) {
  try {
    localStorage.setItem(`${LS_PREFIX}${id}`, JSON.stringify({ ts: Date.now() }));
  } catch {
    // localStorage not available
  }
}

export function AnnouncementBar() {
  const locale = useLocale();
  const [items, setItems] = useState<AnnouncementItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await clientFetch("/api/announcements", { showErrorToast: false });
        if (!r.ok) return;
        const json = (await r.json()) as { announcements: AnnouncementItem[] };
        if (!cancelled) {
          setItems(json.announcements.filter((a) => !isDismissed(a.id)));
        }
      } catch {
        // silent fail
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleDismiss = (id: string) => {
    dismiss(id);
    setItems((prev) => prev.filter((a) => a.id !== id));
  };

  if (items.length === 0) return null;

  return (
    <div className="space-y-1 px-6 pt-1">
      {items.map((item) => {
        const title = locale === "zh" ? item.titleZh : (item.titleEn ?? item.titleZh);
        const content = locale === "zh" ? item.contentZh : (item.contentEn ?? item.contentZh);
        const linkLabel = locale === "zh"
          ? (item.linkLabelZh ?? "查看详情")
          : (item.linkLabelEn ?? "Learn more");

        return (
          <div
            key={item.id}
            className={cn(
              "group relative flex items-start gap-3 rounded-lg px-4 py-2.5 text-sm",
              "bg-primary/5 ring-1 ring-primary/10"
            )}
          >
            <InfoIcon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground">{title}</p>
              <p className="mt-0.5 text-muted-foreground">{content}</p>
              {item.linkUrl && (
                <a
                  href={item.linkUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  {linkLabel}
                  <ExternalLinkIcon className="h-3 w-3" />
                </a>
              )}
            </div>
            <button
              type="button"
              onClick={() => handleDismiss(item.id)}
              className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
              aria-label="关闭"
            >
              <XIcon className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}