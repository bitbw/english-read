"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ImageIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { postCoverUpload } from "@/lib/post-cover-upload";

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
      const patchRes = await fetch(`/api/books/${bookId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coverUrl: url }),
      });
      if (!patchRes.ok) throw new Error("更新封面失败");
      toast.success("封面已更新");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "操作失败");
    } finally {
      setLoading(false);
    }
  }

  async function removeCover() {
    setLoading(true);
    try {
      const patchRes = await fetch(`/api/books/${bookId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coverUrl: null }),
      });
      if (!patchRes.ok) throw new Error("移除封面失败");
      toast.success("已移除封面");
      router.refresh();
    } catch {
      toast.error("移除失败，请重试");
    } finally {
      setLoading(false);
    }
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
          onClick={removeCover}
        >
          移除
        </Button>
      )}
    </div>
  );
}
