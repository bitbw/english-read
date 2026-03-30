import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export default function AuthErrorPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="text-center space-y-4">
        <AlertTriangle className="h-12 w-12 text-destructive mx-auto" />
        <h1 className="text-xl font-bold">登录出现问题</h1>
        <p className="text-muted-foreground text-sm max-w-xs">
          OAuth 认证失败，可能是授权被拒绝或配置有误。
        </p>
        <Link href="/login" className={cn(buttonVariants())}>重新登录</Link>
      </div>
    </div>
  );
}
