import Link from "next/link";
import {
  BugPlay,
  Search,
  AlertTriangle,
  Newspaper,
  ShieldCheck,
  Code2,
  ChevronRight,
} from "lucide-react";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const devTools = [
  {
    href: "/dev/client-fetch-test",
    label: "clientFetch 调试",
    description: "测试 clientFetch 工具函数的请求和响应",
    icon: BugPlay,
    color: "text-blue-500",
    bg: "bg-blue-500/10",
  },
  {
    href: "/dev/similar-words-api",
    label: "Similar Words API",
    description: "调试相似单词查询接口",
    icon: Search,
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
  },
  {
    href: "/dev/sentry-test",
    label: "Sentry 上报测试",
    description: "测试 Sentry 错误上报是否正常",
    icon: AlertTriangle,
    color: "text-orange-500",
    bg: "bg-orange-500/10",
  },
  {
    href: "/dev/scrape-articles",
    label: "爬取每日文章",
    description: "手动触发 Level Read 文章爬取和查看结果",
    icon: Newspaper,
    color: "text-violet-500",
    bg: "bg-violet-500/10",
  },
  {
    href: "/dev/validation-test",
    label: "validationError 统一测试",
    description: "批量测试 11 个路由的校验失败响应是否返回具体错误原因",
    icon: ShieldCheck,
    color: "text-cyan-500",
    bg: "bg-cyan-500/10",
  },
];

export default function DevIndexPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30">
      {/* Header */}
      <div className="border-b border-border/50 bg-card/50 backdrop-blur-sm">
        <div className="mx-auto max-w-3xl px-6 py-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="rounded-full bg-primary/10 p-2.5">
              <Code2 className="h-5 w-5 text-primary" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">开发工具</h1>
          </div>
          <p className="text-sm text-muted-foreground ml-[3.25rem]">
            内部调试与维护工具集
          </p>
        </div>
      </div>

      {/* Grid */}
      <div className="mx-auto max-w-3xl px-6 py-8">
        <div className="grid gap-4 sm:grid-cols-2">
          {devTools.map((tool) => {
            const Icon = tool.icon;
            return (
              <Link key={tool.href} href={tool.href} className="group block">
                <Card className="h-full transition-all duration-200 hover:shadow-md hover:border-primary/30 hover:-translate-y-0.5">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div
                        className={`rounded-lg ${tool.bg} p-2.5 ring-1 ring-foreground/5`}
                      >
                        <Icon className={`h-5 w-5 ${tool.color}`} />
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors mt-1" />
                    </div>
                    <CardTitle className="mt-3">{tool.label}</CardTitle>
                    <CardDescription>{tool.description}</CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}