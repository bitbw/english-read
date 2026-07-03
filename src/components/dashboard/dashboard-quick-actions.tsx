"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, BookOpenCheck, Sparkles } from "lucide-react";
import { ManualAddVocabularyDialog } from "@/components/vocabulary/manual-add-vocabulary-dialog";
import { useTranslations } from "next-intl";
import Link from "next/link";

export function DashboardQuickActions() {
  const t = useTranslations("dashboard");
  const dt = useTranslations("dialog");
  const [addDialogOpen, setAddDialogOpen] = useState(false);

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
        <Link href="/vocabulary/review">
          <Button variant="outline" size="sm" className="gap-2">
            <BookOpenCheck className="h-4 w-4" />
            {t("startReview")}
          </Button>
        </Link>
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