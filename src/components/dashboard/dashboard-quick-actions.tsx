"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { BookOpenCheck, FileText, Plus, Sparkles } from "lucide-react";
import { ManualAddVocabularyDialog } from "@/components/vocabulary/manual-add-vocabulary-dialog";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { GUIDE_BANNER_DISMISSED_KEY } from "@/components/dashboard/guide-banner";

export function DashboardQuickActions() {
  const t = useTranslations("dashboard");
  const dt = useTranslations("dialog");
  const tt = useTranslations("textreader");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const val = localStorage.getItem(GUIDE_BANNER_DISMISSED_KEY);
      setBannerDismissed(val === "true");
    } catch {
      /* ignore */
    }
  }, []);

  if (!mounted) return null;

  return (
    <>
      <div className="flex flex-wrap gap-3">
        <Button
          onClick={() => setAddDialogOpen(true)}
          variant="outline"
          size="sm"
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          {dt("addToVocab")}
        </Button>
        <Link href="/textreader">
          <Button variant="outline" size="sm" className="gap-2">
            <FileText className="h-4 w-4" />
            {tt("title")}
          </Button>
        </Link>
        {bannerDismissed ? (
          <Link href="/guide">
            <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground">
              <BookOpenCheck className="h-4 w-4" />
              {t("usageGuide")}
            </Button>
          </Link>
        ) : null}
        <Link href="/library/store">
          <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground">
            <Sparkles className="h-4 w-4" />
            {t("goToStore")}
          </Button>
        </Link>
      </div>

      <ManualAddVocabularyDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onAdded={() => {}}
      />
    </>
  );
}