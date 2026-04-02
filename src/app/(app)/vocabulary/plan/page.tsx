import { Suspense } from "react";
import { PlanPageClient } from "./plan-page-client";
import { Skeleton } from "@/components/ui/skeleton";

function PlanFallback() {
  return (
    <div className="max-w-3xl mx-auto space-y-4 p-1">
      <Skeleton className="h-10 w-48" />
      <Skeleton className="h-96 w-full rounded-xl" />
    </div>
  );
}

export default function ReviewPlanPage() {
  return (
    <Suspense fallback={<PlanFallback />}>
      <PlanPageClient />
    </Suspense>
  );
}
