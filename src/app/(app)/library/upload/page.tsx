import { EpubUpload } from "@/components/library/epub-upload";
import { BackButton } from "@/components/back-button";
import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import {
  MAX_SELF_UPLOADED_BOOKS,
  countSelfUploadedBooks,
  isSelfUploadLimitReached,
} from "@/lib/bookshelf-limits";

export default async function UploadPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const t = await getTranslations("upload");
  const selfUploadedCount = await countSelfUploadedBooks(session.user.id);
  const uploadLimitReached = isSelfUploadLimitReached(selfUploadedCount);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <BackButton fallbackHref="/library" />
        <div>
          <h1 className="text-2xl font-bold">{t("pageTitle")}</h1>
          <p className="text-sm text-muted-foreground">
            {uploadLimitReached
              ? t("pageSubtitleLimitReached", { max: MAX_SELF_UPLOADED_BOOKS })
              : t("pageSubtitleWithQuota", {
                  current: selfUploadedCount,
                  max: MAX_SELF_UPLOADED_BOOKS,
                })}
          </p>
        </div>
      </div>

      <EpubUpload
        selfUploadedCount={selfUploadedCount}
        maxSelfUploaded={MAX_SELF_UPLOADED_BOOKS}
        uploadLimitReached={uploadLimitReached}
      />
    </div>
  );
}
