"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { VOCABULARY_DAILY_ADD_LIMIT } from "@/lib/vocabulary-daily-limit";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function VocabularyDailyLimitDialog({ open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" showCloseButton>
        <DialogHeader>
          <DialogTitle>今日无法继续添加</DialogTitle>
          <DialogDescription className="text-left">
            为帮助你保持规律复习，每天最多添加 {VOCABULARY_DAILY_ADD_LIMIT}{" "}
            个生词，今日已达上限。请先完成待复习内容，明天再继续积累新词。
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end pt-1">
          <Button type="button" onClick={() => onOpenChange(false)}>
            知道了
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
