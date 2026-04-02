import { Suspense } from "react";
import { ReviewPageClient } from "./review-page-client";
import { Skeleton } from "@/components/ui/skeleton";

function ReviewFallback() {
  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}

export default function ReviewPage() {
  return (
    <Suspense fallback={<ReviewFallback />}>
      <ReviewPageClient />
    </Suspense>
  );
}
