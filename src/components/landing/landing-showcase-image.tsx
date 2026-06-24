import Image from "next/image";
import { cn } from "@/lib/utils";

type LandingShowcaseImageProps = {
  src: string;
  alt: string;
  priority?: boolean;
  className?: string;
};

export function LandingShowcaseImage({
  src,
  alt,
  priority = false,
  className,
}: LandingShowcaseImageProps) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-border bg-card shadow-lg ring-1 ring-black/5 dark:ring-white/10",
        className,
      )}
    >
      <Image
        src={src}
        alt={alt}
        width={1280}
        height={720}
        priority={priority}
        sizes="(max-width: 768px) 100vw, 50vw"
        className="h-auto w-full"
      />
    </div>
  );
}
