import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/** 与公共书详情页布局一致，减轻路由切换时的空白等待感 */
export default function PublicBookDetailLoading() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Skeleton className="h-8 w-28 rounded-lg" />
      <Card className="overflow-hidden py-0 gap-0 shadow-sm ring-1 ring-foreground/10">
        <CardContent className="p-0">
          <div className="grid md:grid-cols-[240px_1fr] lg:grid-cols-[260px_1fr] gap-0">
            <div className="relative bg-gradient-to-br from-muted/60 via-muted/30 to-primary/5 p-6 sm:p-8 md:p-10 flex justify-center md:justify-start border-b md:border-b-0 md:border-r border-border/60">
              <Skeleton className="w-full max-w-[200px] md:max-w-none md:w-full aspect-[2/3] rounded-lg" />
            </div>
            <div className="flex flex-col p-6 sm:p-8 gap-4 min-w-0">
              <div className="flex flex-wrap gap-2">
                <Skeleton className="h-5 w-24 rounded-full" />
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>
              <Skeleton className="h-9 w-full max-w-lg" />
              <Skeleton className="h-5 w-40" />
              <div className="my-2 h-px bg-border shrink-0" aria-hidden />
              <div className="rounded-xl border border-border/80 bg-muted/25 p-4 space-y-4">
                <Skeleton className="h-14 w-full rounded-lg" />
                <Skeleton className="h-14 w-full rounded-lg" />
                <Skeleton className="h-14 w-full rounded-lg" />
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex-col items-stretch gap-4 sm:flex-row sm:items-center sm:justify-between border-t bg-muted/40 px-6 py-5 sm:px-8">
          <Skeleton className="h-4 w-full max-w-md order-2 sm:order-1" />
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto order-1 sm:order-2 shrink-0">
            <Skeleton className="h-9 w-full sm:w-32 rounded-lg" />
            <Skeleton className="h-9 w-full sm:w-32 rounded-lg" />
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
