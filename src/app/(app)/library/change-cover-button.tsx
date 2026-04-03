"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ImageIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { postCoverUpload } from "@/lib/post-cover-upload";
import { CLIENT_FETCH_NETWORK_ERROR, clientFetch } from "@/lib/client-fetch";
import { toastConfirmAction } from "@/lib/toast-confirm";

interface ChangeCoverButtonProps {
  bookId: string;
  hasCover: boolean;
}

export function ChangeCoverButton({ bookId, hasCover }: ChangeCoverButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

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
      toast.success("封面已更新");
      router.refresh();
    } catch (err) {
      if (err instanceof Error && err.message === CLIENT_FETCH_NETWORK_ERROR) {
        /* clientFetch 已 toast */
      } else {
        toast.error(err instanceof Error ? err.message : "操作失败");
      }
    } finally {
      setLoading(false);
    }
  }

  function requestRemoveCover() {
    toastConfirmAction({
      message: "确定移除封面？",
      description: "移除后书架将显示默认占位图，可随时重新上传。",
      confirmLabel: "确认移除",
      onConfirm: async () => {
        setLoading(true);
        try {
          const patchRes = await clientFetch(`/api/books/${bookId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ coverUrl: null }),
          });
          if (!patchRes.ok) return;
          toast.success("已移除封面");
          router.refresh();
        } catch (err) {
          if (!(err instanceof Error && err.message === CLIENT_FETCH_NETWORK_ERROR)) {
            toast.error("移除失败，请重试");
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
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-muted-foreground"
        disabled={loading}
        title="更换封面"
        onClick={() => inputRef.current?.click()}
      >
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImageIcon className="h-3.5 w-3.5" />}
      </Button>
      {hasCover && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-1.5 text-xs text-muted-foreground"
          disabled={loading}
          onClick={requestRemoveCover}
        >
          移除
        </Button>
      )}
    </div>
  );
}
