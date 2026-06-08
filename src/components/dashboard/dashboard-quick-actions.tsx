"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { ManualAddVocabularyDialog } from "@/components/vocabulary/manual-add-vocabulary-dialog";
import { useTranslations } from "next-intl";

export function DashboardQuickActions() {
  const t = useTranslations("dashboard");
  const dt = useTranslations("dialog");
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  return (
    <>
      <Card className="border-dashed border-primary/30 hover:border-primary/60 transition-colors">
        <CardContent className="flex items-center gap-4 pt-6">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Plus className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-sm text-muted-foreground">{t("quickAddVocab")}</p>
            <Button
              onClick={() => setAddDialogOpen(true)}
              variant="outline"
              size="sm"
              className="mt-1"
            >
              <Plus className="h-4 w-4 mr-1" />
              {dt("addToVocab")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <ManualAddVocabularyDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onAdded={() => {}}
      />
    </>
  );
}