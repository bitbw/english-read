"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { BookmarkX } from "lucide-react";
import { toast } from "sonner";
import { CLIENT_FETCH_NETWORK_ERROR, clientFetch } from "@/lib/client-fetch";
import { toastConfirmAction } from "@/lib/toast-confirm";

interface RemoveFromShelfButtonProps {
  bookId: string;
  bookTitle: string;
}

/** 从公共书库加入的书：仅从「我的书架」移除个人记录，不删公共 Blob（与 DELETE API 行为一致） */
export function RemoveFromShelfButton({ bookId, bookTitle }: RemoveFromShelfButtonProps) {
  const router = useRouter();

  function requestRemove() {
    toastConfirmAction({
      message: "从书架移除？",
      description: `《${bookTitle}》将仅从「我的书架」中移除；公共书库中的书仍可被他人浏览，需要时可从公共书库再次加入。`,
      confirmLabel: "确认移除",
      onConfirm: async () => {
        try {
          const res = await clientFetch(`/api/books/${bookId}`, { method: "DELETE" });
          if (!res.ok) return;
          toast.success("已从书架移除");
          router.refresh();
        } catch (err) {
          if (!(err instanceof Error && err.message === CLIENT_FETCH_NETWORK_ERROR)) {
            toast.error("移除失败，请重试");
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
      title="从书架移除"
      onClick={requestRemove}
    >
      <BookmarkX className="h-3.5 w-3.5" />
    </Button>
  );
}
