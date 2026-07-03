import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="max-w-5xl mx-auto">
      {/* Hero skeleton */}
      <div className="pb-6 mb-6 border-b border-border/40">
        <div className="space-y-2">
          <Skeleton className="h-9 w-64 max-w-full" />
          <Skeleton className="h-4 w-48" />
        </div>
      </div>

      {/* Bento grid skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
        {/* Left column */}
        <div className="md:col-span-2 space-y-5">
          {/* Quick actions skeleton */}
          <div className="flex flex-wrap gap-3">
            <Skeleton className="h-9 w-28 rounded-lg" />
            <Skeleton className="h-9 w-28 rounded-lg" />
            <Skeleton className="h-9 w-28 rounded-lg" />
          </div>

          {/* Vocab + Bookshelf 2-col skeleton */}
          <div className="grid grid-cols-2 gap-5">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="rounded-xl ring-1 ring-foreground/10 p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-4 rounded" />
                </div>
                <Skeleton className="h-9 w-16" />
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-1 w-full rounded-full" />
              </div>
            ))}
          </div>
        </div>

        {/* Right column: due review skeleton (tall) */}
        <div className="rounded-xl ring-1 ring-foreground/10 p-6 space-y-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-12 w-20" />
          <Skeleton className="h-1.5 w-full rounded-full" />
          <Skeleton className="h-3 w-36" />
        </div>
      </div>

      {/* Chart skeleton */}
      <Card className="overflow-hidden mb-6">
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-[118px] w-full rounded-md" />
        </CardContent>
      </Card>

      {/* Recent reading horizontal skeleton */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-8 w-24 rounded-lg" />
        </div>
        <div className="flex gap-4 overflow-hidden">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="min-w-[200px] rounded-xl ring-1 ring-foreground/10 overflow-hidden"
            >
              <Skeleton className="aspect-[3/4] w-full" />
              <div className="p-3 space-y-2">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-1 w-full rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}