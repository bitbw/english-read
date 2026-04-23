"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ImageIcon, ImageOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { postCoverUpload } from "@/lib/post-cover-upload";
import { CLIENT_FETCH_NETWORK_ERROR, clientFetch } from "@/lib/client-fetch";
import { toastConfirmAction } from "@/lib/toast-confirm";
import { useTranslations } from "next-intl";

interface ChangeCoverButtonProps {
  bookId: string;
  hasCover: boolean;
}

export function ChangeCoverButton({ bookId, hasCover }: ChangeCoverButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const t = useTranslations("library");

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setLoading(true);
    try {
      const { url } = await postCoverUpload(file);
      const patchRes = await clientFetch(`/api/books/${bookId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coverUrl: url }),
      });
      if (!patchRes.ok) return;
      toast.success(t("changeCoverUpdated"));
      router.refresh();
    } catch (err) {
      if (err instanceof Error && err.message === CLIENT_FETCH_NETWORK_ERROR) {
        /* clientFetch 已 toast */
      } else {
        toast.error(err instanceof Error ? err.message : t("changeCoverFailed"));
      }
    } finally {
      setLoading(false);
    }
  }

  function requestRemoveCover() {
    toastConfirmAction({
      message: t("removeCoverConfirm"),
      description: t("removeCoverDesc"),
      confirmLabel: t("removeCoverConfirmBtn"),
      onConfirm: async () => {
        setLoading(true);
        try {
          const patchRes = await clientFetch(`/api/books/${bookId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ coverUrl: null }),
          });
          if (!patchRes.ok) return;
          toast.success(t("removeCoverSuccess"));
          router.refresh();
        } catch (err) {
          if (!(err instanceof Error && err.message === CLIENT_FETCH_NETWORK_ERROR)) {
            toast.error(t("removeCoverFailed"));
          }
        } finally {
          setLoading(false);
        }
      },
    });
  }

  return (
    <div className="flex items-center gap-0.5">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={onFile}
      />
      {hasCover ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground"
          disabled={loading}
          title={t("removeCoverBtn")}
          onClick={requestRemoveCover}
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImageOff className="h-3.5 w-3.5" />}
        </Button>
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground"
          disabled={loading}
          title={t("addCoverBtn")}
          onClick={() => inputRef.current?.click()}
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImageIcon className="h-3.5 w-3.5" />}
        </Button>
      )}
    </div>
  );
}
