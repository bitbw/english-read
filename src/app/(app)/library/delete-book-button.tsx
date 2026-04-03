"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { CLIENT_FETCH_NETWORK_ERROR, clientFetch } from "@/lib/client-fetch";
import { toastConfirmAction } from "@/lib/toast-confirm";

interface DeleteBookButtonProps {
  bookId: string;
  bookTitle: string;
}

export function DeleteBookButton({ bookId, bookTitle }: DeleteBookButtonProps) {
  const router = useRouter();

  function requestDelete() {
    toastConfirmAction({
      message: "确定删除这本书？",
      description: `《${bookTitle}》及关联文件将无法恢复。`,
      confirmLabel: "确认删除",
      onConfirm: async () => {
        try {
          const res = await clientFetch(`/api/books/${bookId}`, { method: "DELETE" });
          if (!res.ok) return;
          toast.success("书籍已删除");
          router.refresh();
        } catch (err) {
          if (!(err instanceof Error && err.message === CLIENT_FETCH_NETWORK_ERROR)) {
            toast.error("删除失败，请重试");
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
      title="删除书籍"
      onClick={requestDelete}
    >
      <Trash2 className="h-3.5 w-3.5" />
    </Button>
  );
}
