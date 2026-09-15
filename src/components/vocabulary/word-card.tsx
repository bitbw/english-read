"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getStageName, getStageColor } from "@/lib/srs";
import { Trash2 } from "lucide-react";
import { MoreHorizontal } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { formatDistanceToNow } from "date-fns";
import { zhCN, enUS } from "date-fns/locale";
import { linkifyToReactNodes } from "@/components/linkified-text";
import { VocabularyDefinitionView } from "@/components/vocabulary/vocabulary-definition-view";
import { useTranslations, useLocale } from "next-intl";

interface VocabWord {
  id: string;
  word: string;
  phonetic: string | null;
  definition: string | null;
  context: string | null;
  reviewStage: number;
  nextReviewAt: Date | string;
  isMastered: boolean;
  createdAt: Date | string;
}

interface WordCardProps {
  word: VocabWord;
  onDelete?: (id: string) => void;
  onStatusChange?: (id: string, status: "remembered" | "forgotten" | "mastered") => void;
}

export function WordCard({ word, onDelete, onStatusChange }: WordCardProps) {
  const t = useTranslations("vocabulary");
  const locale = useLocale();
  const dateFnsLocale = locale === "zh" ? zhCN : enUS;
  const nextReview = new Date(word.nextReviewAt);
  const isPastDue = !word.isMastered && nextReview <= new Date();

  return (
    <Card className="p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          {/* 单词 + 音标 */}
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="font-bold text-lg">{word.word}</span>
            {word.phonetic && (
              <span className="text-sm text-muted-foreground">{word.phonetic}</span>
            )}
            <Badge className={`text-xs px-1.5 py-0 ${getStageColor(word.reviewStage, word.isMastered)}`}>
              {getStageName(word.reviewStage, word.isMastered)}
            </Badge>
            {isPastDue && (
              <Badge variant="destructive" className="text-xs px-1.5 py-0">
                {t("dueReview")}
              </Badge>
            )}
          </div>

          {/* 释义：「译」条单独展示中文，下为英义 */}
          <VocabularyDefinitionView
            definition={word.definition}
            className="mt-1.5"
            emptyFallback={<p className="mt-1 text-sm text-muted-foreground">{t("noDefinition")}</p>}
          />

          {/* 上下文 */}
          {word.context && (
            <p className="mt-1.5 text-xs text-muted-foreground italic line-clamp-3 wrap-break-word border-l-2 border-muted pl-2">
              {linkifyToReactNodes(word.context)}
            </p>
          )}

          {/* 下次复习时间 */}
          {!word.isMastered && (
            <p className="mt-2 text-xs text-muted-foreground">
              {isPastDue
                ? t("reviewNow")
                : t("nextReview", { time: formatDistanceToNow(nextReview, { addSuffix: true, locale: dateFnsLocale }) })}
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {onStatusChange ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label={t("statusActions")}
              >
                <MoreHorizontal className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {word.isMastered || word.reviewStage < 6 ? (
                  <DropdownMenuItem onClick={() => onStatusChange(word.id, "remembered")}>
                    {t("statusRemembered")}
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuItem onClick={() => onStatusChange(word.id, "forgotten")}>
                  {t("statusForgotten")}
                </DropdownMenuItem>
                {!word.isMastered && word.reviewStage >= 6 ? (
                  <DropdownMenuItem onClick={() => onStatusChange(word.id, "mastered")}>
                    {t("statusMastered")}
                  </DropdownMenuItem>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
          {onDelete && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              onClick={() => onDelete(word.id)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
