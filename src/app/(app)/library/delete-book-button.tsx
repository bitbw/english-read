"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { CLIENT_FETCH_NETWORK_ERROR, clientFetch } from "@/lib/client-fetch";
import { toastConfirmAction } from "@/lib/toast-confirm";
import { useTranslations } from "next-intl";

interface DeleteBookButtonProps {
  bookId: string;
  bookTitle: string;
}

export function DeleteBookButton({ bookId, bookTitle }: DeleteBookButtonProps) {
  const router = useRouter();
  const t = useTranslations("library");

  function requestDelete() {
    toastConfirmAction({
      message: t("deleteBookConfirm"),
      description: t("deleteBookDesc", { title: bookTitle }),
      confirmLabel: t("deleteBookConfirmBtn"),
      onConfirm: async () => {
        try {
          const res = await clientFetch(`/api/books/${bookId}`, { method: "DELETE" });
          if (!res.ok) return;
          toast.success(t("deleteBookSuccess"));
          router.refresh();
        } catch (err) {
          if (!(err instanceof Error && err.message === CLIENT_FETCH_NETWORK_ERROR)) {
            toast.error(t("deleteBookFailed"));
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
      className="h-7 w-7 text-muted-foreground hover:text-destructive"
      title={t("deleteBookBtn")}
      onClick={requestDelete}
    >
      <Trash2 className="h-3.5 w-3.5" />
    </Button>
  );
}
