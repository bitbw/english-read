"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { vocabularyDefinitionPreview } from "@/components/vocabulary/vocabulary-definition-view";
import { getStageColor, getStageName } from "@/lib/srs";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { Trash2 } from "lucide-react";

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
  return (
    <div className="overflow-x-auto rounded-xl border border-foreground/10 bg-card ring-1 ring-foreground/10">
      <table className="w-full min-w-[640px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-foreground/10 bg-muted/40 text-xs font-medium text-muted-foreground">
            <th className="w-12 min-w-12 px-1 py-2 pl-3 text-center font-medium tabular-nums">序号</th>
            <th className="px-2 py-2 font-medium">单词</th>
            <th className="px-2 py-2 font-medium min-w-[200px]">释义</th>
            <th className="px-2 py-2 font-medium whitespace-nowrap">阶段</th>
            <th className="px-2 py-2 font-medium whitespace-nowrap">复习</th>
            <th className="px-2 py-2 font-medium whitespace-nowrap">音标</th>
            <th className="px-2 py-2 pr-3 font-medium w-12 text-right"> </th>
          </tr>
        </thead>
        <tbody>
          {words.map((word, index) => {
            const nextReview = new Date(word.nextReviewAt);
            const isPastDue = !word.isMastered && nextReview <= new Date();
            const preview = vocabularyDefinitionPreview(word.definition, 100);
            return (
              <tr
                key={word.id}
                className="border-b border-foreground/5 last:border-0 hover:bg-muted/30 transition-colors"
              >
                <td className="px-1 py-1.5 pl-3 align-top text-center text-xs tabular-nums text-muted-foreground">
                  {index + 1}
                </td>
                <td className="px-2 py-1.5 align-top">
                  <span className="font-semibold text-foreground">{word.word}</span>
                </td>
                <td className="px-2 py-1.5 align-top">
                  <div className="space-y-0.5 min-w-0">
                    <p className={cn("text-foreground leading-snug line-clamp-2", !preview && "text-muted-foreground")}>
                      {preview || "暂无释义"}
                    </p>
                    {word.context ? (
                      <p className="text-xs text-muted-foreground italic line-clamp-1 wrap-break-word">
                        {word.context}
                      </p>
                    ) : null}
                  </div>
                </td>
                <td className="px-2 py-1.5 align-top whitespace-nowrap">
                  <Badge className={cn("text-[10px] px-1.5 py-0 font-normal", getStageColor(word.reviewStage))}>
                    {getStageName(word.reviewStage)}
                  </Badge>
                </td>
                <td className="px-2 py-1.5 align-top whitespace-nowrap text-xs text-muted-foreground">
                  {word.isMastered ? (
                    <span>已掌握</span>
                  ) : isPastDue ? (
                    <Badge variant="destructive" className="text-[10px] px-1.5 py-0 font-normal">
                      待复习
                    </Badge>
                  ) : (
                    <span title={nextReview.toLocaleString()}>
                      {formatDistanceToNow(nextReview, { addSuffix: true, locale: zhCN })}
                    </span>
                  )}
                </td>
                <td className="px-2 py-1.5 align-top text-muted-foreground text-xs whitespace-nowrap max-w-[140px] truncate" title={word.phonetic ?? undefined}>
                  {word.phonetic ?? "—"}
                </td>
                <td className="px-2 py-1.5 pr-3 align-top text-right">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => onDelete(word.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
