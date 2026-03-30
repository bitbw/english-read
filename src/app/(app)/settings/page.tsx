"use client";

import { useSession, signOut } from "next-auth/react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

export default function SettingsPage() {
  const { data: session } = useSession();

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">设置</h1>

      {/* 账户信息 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">账户信息</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-4">
          <Avatar className="h-14 w-14">
            <AvatarImage src={session?.user?.image ?? ""} />
            <AvatarFallback className="text-lg">
              {session?.user?.name?.[0]?.toUpperCase() ?? "U"}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium">{session?.user?.name}</p>
            <p className="text-sm text-muted-foreground">{session?.user?.email}</p>
          </div>
        </CardContent>
      </Card>

      {/* 主题 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">外观</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">主题模式</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              切换浅色 / 深色 / 跟随系统
            </p>
          </div>
          <ThemeToggle />
        </CardContent>
      </Card>

      {/* 关于 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">关于</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>English Read v1.0</p>
          <p>基于 Next.js 14 + Vercel 构建的英语阅读工具</p>
          <p>词汇复习采用艾宾浩斯遗忘曲线算法</p>
        </CardContent>
      </Card>

      {/* 退出登录 */}
      <Card className="border-destructive/30">
        <CardContent className="pt-6">
          <Button
            variant="destructive"
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="w-full"
          >
            <LogOut className="h-4 w-4 mr-2" />
            退出登录
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
