import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { BookOpen, BookMarked, GraduationCap, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

export default async function LandingPage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  const features = [
    { icon: BookOpen, title: "EPUB 阅读器", desc: "导入 EPUB 电子书，在线流畅阅读，自动保存阅读进度" },
    { icon: BookMarked, title: "生词本", desc: "阅读时选中单词一键保存，自动查询音标和释义" },
    { icon: GraduationCap, title: "智能复习", desc: "基于艾宾浩斯遗忘曲线安排复习，高效记住单词" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            <span className="font-bold">English Read</span>
          </div>
          <Link href="/login" className={cn(buttonVariants({ size: "sm" }))}>登录</Link>
        </div>
      </header>

      <section className="max-w-5xl mx-auto px-6 py-24 text-center">
        <h1 className="text-5xl font-bold leading-tight">边读书，边记单词</h1>
        <p className="mt-4 text-xl text-muted-foreground max-w-2xl mx-auto">
          导入你的 EPUB 电子书，阅读时随手标记生词，用艾宾浩斯遗忘曲线科学复习，让词汇量稳步提升。
        </p>
        <div className="mt-8 flex justify-center">
          <Link href="/login" className={cn(buttonVariants({ size: "lg" }))}>
            免费开始<ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-6 pb-24">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {features.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="p-6 rounded-xl border border-border bg-card">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-semibold mb-2">{title}</h3>
              <p className="text-sm text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-muted/30 border-t border-border">
        <div className="max-w-3xl mx-auto px-6 py-16 text-center">
          <h2 className="text-2xl font-bold mb-4">艾宾浩斯遗忘曲线复习计划</h2>
          <p className="text-muted-foreground mb-8">仿英语帮 App，科学安排复习节点，一个单词最多复习 6 次即可掌握</p>
          <div className="flex flex-wrap justify-center gap-3">
            {[
              { stage: "新词", days: "1 天后" },
              { stage: "第1次", days: "2 天后" },
              { stage: "第2次", days: "4 天后" },
              { stage: "第3次", days: "7 天后" },
              { stage: "第4次", days: "15 天后" },
              { stage: "第5次", days: "30 天后 → 掌握" },
            ].map(({ stage, days }) => (
              <div key={stage} className="px-4 py-2 rounded-full bg-background border border-border text-sm">
                <span className="font-medium">{stage}</span>
                <span className="text-muted-foreground ml-2">→ {days}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
