import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { books, publicLibraryBooks, users } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import {
  PublicBookDetailClient,
  type PublicBookDetailPayload,
} from "@/components/library/public-book-detail-client";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import type { ReadingTierId } from "@/lib/reading-tiers";

interface PageProps {
  params: Promise<{ publicBookId: string }>;
}

export default async function PublicBookDetailPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = session.user.id;
  const { publicBookId } = await params;

  const [publicRows, shelfRows] = await Promise.all([
    db
      .select({
        id: publicLibraryBooks.id,
        title: publicLibraryBooks.title,
        author: publicLibraryBooks.author,
        coverUrl: publicLibraryBooks.coverUrl,
        tier: publicLibraryBooks.tier,
        fileSize: publicLibraryBooks.fileSize,
        createdAt: publicLibraryBooks.createdAt,
        uploaderName: users.name,
      })
      .from(publicLibraryBooks)
      .leftJoin(users, eq(publicLibraryBooks.uploadedBy, users.id))
      .where(eq(publicLibraryBooks.id, publicBookId)),
    db
      .select({ id: books.id })
      .from(books)
      .where(and(eq(books.userId, userId), eq(books.publicBookId, publicBookId))),
  ]);

  const row = publicRows[0];
  if (!row) notFound();

  const shelf = shelfRows[0];

  const payload: PublicBookDetailPayload = {
    id: row.id,
    title: row.title,
    author: row.author,
    coverUrl: row.coverUrl,
    tier: row.tier as ReadingTierId,
    fileSize: row.fileSize,
    createdAtLabel: format(row.createdAt, "yyyy-MM-dd HH:mm", { locale: zhCN }),
    uploaderName: row.uploaderName,
    shelfBookId: shelf?.id ?? null,
  };

  return <PublicBookDetailClient book={payload} />;
}
