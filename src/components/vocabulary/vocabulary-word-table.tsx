"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { vocabularyDefinitionPreview } from "@/components/vocabulary/vocabulary-definition-view";
import { getStageColor, getStageName } from "@/lib/srs";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { zhCN, enUS } from "date-fns/locale";
import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";

interface VocabWord {
  id: string;
  word: string;
  phonetic: string | null;
  definition: string | null;
  context: string | null;
  reviewStage: number;
  nextReviewAt: string;
  isMastered: boolean;
  createdAt: string;
}

interface VocabularyWordTableProps {
  words: VocabWord[];
  onDelete: (id: string) => void;
}

export function VocabularyWordTable({ words, onDelete }: VocabularyWordTableProps) {
  const t = useTranslations("vocabulary");
  const locale = useLocale();
  const dateFnsLocale = locale === "zh" ? zhCN : enUS;
  return (
    <div className="rounded-xl border border-foreground/10 bg-card">
      <Table className="min-w-[640px]">
        <TableHeader className="[&_th]:text-xs [&_th]:text-muted-foreground">
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead className="w-12 pl-3 text-center tabular-nums">{t("tableNo")}</TableHead>
            <TableHead>{t("tableWord")}</TableHead>
            <TableHead className="min-w-[200px] whitespace-normal">{t("tableDefinition")}</TableHead>
            <TableHead>{t("tableStage")}</TableHead>
            <TableHead>{t("tableReview")}</TableHead>
            <TableHead>{t("tablePhonetic")}</TableHead>
            <TableHead className="w-12 pr-3 text-right">
              <span className="sr-only">{t("tableActions")}</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="[&_td]:align-top">
          {words.map((word, index) => {
            const nextReview = new Date(word.nextReviewAt);
            const isPastDue = !word.isMastered && nextReview <= new Date();
            const preview = vocabularyDefinitionPreview(word.definition, 100);
            return (
              <TableRow key={word.id}>
                <TableCell className="pl-3 text-center tabular-nums text-muted-foreground">
                  {index + 1}
                </TableCell>
                <TableCell className="font-semibold">{word.word}</TableCell>
                <TableCell className="min-w-[200px] max-w-[min(28rem,50vw)] whitespace-normal">
                  <div className="min-w-0 space-y-0.5">
                    <p
                      className={cn(
                        "line-clamp-2 leading-snug",
                        !preview && "text-muted-foreground"
                      )}
                    >
                      {preview || t("noDefinition")}
                    </p>
                    {word.context ? (
                      <p className="line-clamp-1 text-xs italic text-muted-foreground wrap-break-word">
                        {word.context}
                      </p>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge className={cn("px-1.5 py-0 text-[10px] font-normal", getStageColor(word.reviewStage))}>
                    {getStageName(word.reviewStage)}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {word.isMastered ? (
                    <span>{t("mastered")}</span>
                  ) : isPastDue ? (
                    <Badge variant="destructive" className="px-1.5 py-0 text-[10px] font-normal">
                      {t("dueReview")}
                    </Badge>
                  ) : (
                    <span title={nextReview.toLocaleString()}>
                      {formatDistanceToNow(nextReview, { addSuffix: true, locale: dateFnsLocale })}
                    </span>
                  )}
                </TableCell>
                <TableCell
                  className="max-w-[140px] truncate text-muted-foreground"
                  title={word.phonetic ?? undefined}
                >
                  {word.phonetic ?? "—"}
                </TableCell>
                <TableCell className="pr-3 text-right">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => onDelete(word.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
