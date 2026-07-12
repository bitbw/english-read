"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

interface BackButtonProps {
  /** 当没有上一个历史记录时的回退路径 */
  fallbackHref?: string;
  /** 可选：aria-label */
  label?: string;
  className?: string;
}

export function BackButton({ fallbackHref = "/dashboard", label, className }: BackButtonProps) {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => {
        if (window.history.length > 1) {
          router.back();
        } else {
          router.replace(fallbackHref);
        }
      }}
      className={cn(
        buttonVariants({ variant: "ghost", size: "icon" }),
        className,
      )}
      aria-label={label ?? "返回"}
    >
      <ArrowLeft className="h-4 w-4" />
    </button>
  );
}