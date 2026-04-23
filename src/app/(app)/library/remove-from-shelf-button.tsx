"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { BookmarkX } from "lucide-react";
import { toast } from "sonner";
import { CLIENT_FETCH_NETWORK_ERROR, clientFetch } from "@/lib/client-fetch";
import { toastConfirmAction } from "@/lib/toast-confirm";
import { useTranslations } from "next-intl";

interface RemoveFromShelfButtonProps {
  bookId: string;
  bookTitle: string;
}

/** 从公共书库加入的书：仅从「我的书架」移除个人记录，不删公共 Blob（与 DELETE API 行为一致） */
export function RemoveFromShelfButton({ bookId, bookTitle }: RemoveFromShelfButtonProps) {
  const router = useRouter();
  const t = useTranslations("library");

  function requestRemove() {
    toastConfirmAction({
      message: t("removeFromShelfConfirm"),
      description: t("removeFromShelfDesc", { title: bookTitle }),
      confirmLabel: t("removeFromShelfConfirmBtn"),
      onConfirm: async () => {
        try {
          const res = await clientFetch(`/api/books/${bookId}`, { method: "DELETE" });
          if (!res.ok) return;
          toast.success(t("removeFromShelfSuccess"));
          router.refresh();
        } catch (err) {
          if (!(err instanceof Error && err.message === CLIENT_FETCH_NETWORK_ERROR)) {
            toast.error(t("removeFromShelfFailed"));
          }
        }
      },
    });
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-7 w-7 text-muted-foreground hover:text-foreground"
      title={t("removeFromShelfBtn")}
      onClick={requestRemove}
    >
      <BookmarkX className="h-3.5 w-3.5" />
    </Button>
  );
}
