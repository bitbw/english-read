import Link from "next/link";
import { BookOpen } from "lucide-react";

type AuthSplitShellProps = {
  children: React.ReactNode;
};

export function AuthSplitShell({ children }: AuthSplitShellProps) {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex justify-center gap-2 md:justify-start">
          <Link
            href="/"
            className="flex items-center gap-2 font-medium text-foreground"
          >
            <div className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <BookOpen className="size-5" aria-hidden />
            </div>
            English Read
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-xs">{children}</div>
        </div>
      </div>
      <div
        className="relative hidden lg:block bg-muted"
        aria-hidden
      >
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,hsl(var(--primary)/0.18),transparent_55%),radial-gradient(ellipse_at_80%_60%,hsl(var(--primary)/0.12),transparent_50%)]" />
      </div>
    </div>
  );
}
