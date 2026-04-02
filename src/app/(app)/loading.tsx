import { Loader2 } from "lucide-react";

export default function AppLoading() {
  return (
    <div
      className="flex min-h-[min(50vh,24rem)] flex-col items-center justify-center gap-3 py-12"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <Loader2 className="h-9 w-9 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">加载中…</p>
    </div>
  );
}
