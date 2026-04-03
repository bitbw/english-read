"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getStageName, getStageColor } from "@/lib/srs";
import { Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { linkifyToReactNodes } from "@/components/linkified-text";

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
}

type DefRow = { pos: string; def: string; zh?: string };

export function WordCard({ word, onDelete }: WordCardProps) {
  const definitions = (() => {
    if (!word.definition) return [];
    try {
      return JSON.parse(word.definition) as DefRow[];
    } catch {
      return [];
    }
  })();

  const translateRow = definitions.find((d) => d.pos === "译");
  const nonTranslate = definitions.filter((d) => d.pos !== "译");
  const chineseLine = translateRow
    ? (translateRow.zh ?? translateRow.def)
    : "";

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
            <Badge className={`text-xs px-1.5 py-0 ${getStageColor(word.reviewStage)}`}>
              {getStageName(word.reviewStage)}
            </Badge>
            {isPastDue && (
              <Badge variant="destructive" className="text-xs px-1.5 py-0">
                待复习
              </Badge>
            )}
          </div>

          {/* 释义：「译」条单独展示中文，下为英义 */}
          {definitions.length > 0 ? (
            <div className="mt-1.5 space-y-1">
              {chineseLine ? (
                <div className="px-2 py-1.5 bg-muted/60 rounded-md">
                  <p className="text-sm font-medium text-foreground">{chineseLine}</p>
                </div>
              ) : null}
              {nonTranslate.length > 0 ? (
                <div className="space-y-0.5">
                  {nonTranslate.slice(0, 2).map((d, i) => (
                    <p key={i} className="text-sm text-foreground">
                      <span className="text-muted-foreground text-xs mr-1">{d.pos}.</span>
                      {d.def}
                    </p>
                  ))}
                </div>
              ) : null}
            </div>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">暂无释义</p>
          )}

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
                ? "现在可以复习"
                : `下次复习：${formatDistanceToNow(nextReview, { addSuffix: true, locale: zhCN })}`}
            </p>
          )}
        </div>

        {/* 删除按钮 */}
        {onDelete && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
            onClick={() => onDelete(word.id)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </Card>
  );
}
