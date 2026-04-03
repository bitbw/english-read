import { notFound } from "next/navigation";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

export default function DevIndexPage() {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  return (
    <div className="mx-auto max-w-lg space-y-4 p-6">
      <h1 className="text-xl font-bold">开发工具</h1>
      <ul className="list-inside list-disc text-sm text-muted-foreground">
        <li>
          <Link
            href="/dev/client-fetch-test"
            className={cn(buttonVariants({ variant: "link" }), "inline h-auto p-0 align-baseline")}
          >
            clientFetch 调试
          </Link>
        </li>
      </ul>
    </div>
  );
}
