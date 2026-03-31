import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { books } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { notFound } from "next/navigation";
import { ReaderClient } from "./reader-client";

interface ReadPageProps {
  params: { bookId: string };
}

export default async function ReadPage({ params }: ReadPageProps) {
  const session = await auth();
  if (!session?.user?.id) return null;

  const [book] = await db
    .select()
    .from(books)
    .where(and(eq(books.id, params.bookId), eq(books.userId, session.user.id)));

  if (!book) notFound();

  return (
    <div className="-m-6 h-[calc(100vh-3.5rem)] flex flex-col">
      <ReaderClient
        bookId={book.id}
        title={book.title}
        blobUrl={book.blobUrl}
        initialCfi={book.currentCfi}
      />
    </div>
  );
}
