import { db } from "@/lib/db";
import { dailyArticles } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { ArticleReaderClient } from "./article-reader-client";

export default async function ArticleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const { id } = await params;
  const [article] = await db
    .select()
    .from(dailyArticles)
    .where(eq(dailyArticles.id, id))
    .limit(1);

  if (!article) notFound();

  return <ArticleReaderClient article={article} />;
}
