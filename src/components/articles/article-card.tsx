import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { getTranslations } from "next-intl/server";

interface ArticleCardProps {
  id: string;
  title: string;
  description: string | null;
  coverUrl: string | null;
  wordCount: number | null;
  publishedAt: Date | null;
  createdAt: Date;
  level: number;
}

const levelLabel: Record<number, string> = { 1: "Level 1", 2: "Level 2", 3: "Level 3" };
const levelColor: Record<number, string> = {
  1: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  2: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  3: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
};

export async function ArticleCard({
  id,
  title,
  description,
  coverUrl,
  wordCount,
  publishedAt,
  createdAt,
  level,
}: ArticleCardProps) {
  const t = await getTranslations("articles");
  const displayDate = publishedAt ?? createdAt;
  const dateStr = format(displayDate, "yyyy/MM/dd");

  return (
    <Link
      href={`/articles/${id}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card hover:shadow-md transition-shadow duration-200"
    >
      {/* Cover image */}
      <div className="relative aspect-video bg-muted overflow-hidden">
        {coverUrl ? (
          <Image
            src={coverUrl}
            alt={title}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            unoptimized
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-gradient-to-br from-primary/10 to-primary/5">
            <span className="text-4xl font-bold text-primary/30 select-none">
              {title.charAt(0).toUpperCase()}
            </span>
          </div>
        )}
        <span
          className={cn(
            "absolute top-2 left-2 rounded-full px-2 py-0.5 text-[10px] font-semibold",
            levelColor[level] ?? levelColor[1]
          )}
        >
          {levelLabel[level] ?? "Level 1"}
        </span>
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <p className="line-clamp-2 text-sm font-semibold leading-snug text-foreground group-hover:text-primary transition-colors">
          {title}
        </p>
        {description && (
          <p className="line-clamp-2 text-xs text-muted-foreground leading-relaxed">{description}</p>
        )}
        <div className="mt-auto flex items-center gap-2 pt-1 text-[11px] text-muted-foreground">
          <span>{dateStr}</span>
          {wordCount ? (
            <>
              <span>·</span>
              <span>{t("words", { count: wordCount })}</span>
            </>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
