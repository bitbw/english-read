"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle } from "lucide-react";

interface ReviewWord {
  id: string;
  word: string;
  phonetic: string | null;
  definition: string | null;
  context: string | null;
  reviewStage: number;
}

interface ReviewSessionProps {
  words: ReviewWord[];
  onComplete: (results: { remembered: number; forgotten: number }) => void;
}

export function ReviewSession({ words, onComplete }: ReviewSessionProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [results, setResults] = useState({ remembered: 0, forgotten: 0 });
  const [finished, setFinished] = useState(false);

  const current = words[currentIndex];
  const progress = (currentIndex / words.length) * 100;

  const definitions = (() => {
    if (!current?.definition) return [];
    try {
      return JSON.parse(current.definition) as { pos: string; def: string }[];
    } catch {
      return [];
    }
  })();

  async function handleResult(result: "remembered" | "forgotten") {
    // 提交复习结果
    await fetch("/api/review/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vocabularyId: current.id, result }),
    });

    const newResults = {
      remembered: results.remembered + (result === "remembered" ? 1 : 0),
      forgotten: results.forgotten + (result === "forgotten" ? 1 : 0),
    };
    setResults(newResults);

    if (currentIndex + 1 >= words.length) {
      setFinished(true);
      onComplete(newResults);
    } else {
      setCurrentIndex((i) => i + 1);
      setFlipped(false);
    }
  }

  if (finished) {
    return (
      <div className="flex flex-col items-center justify-center gap-6 py-12">
        <div className="text-4xl">🎉</div>
        <h2 className="text-2xl font-bold">复习完成！</h2>
        <div className="flex gap-6 text-center">
          <div>
            <p className="text-3xl font-bold text-green-600">{results.remembered}</p>
            <p className="text-sm text-muted-foreground mt-1">认识</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-red-500">{results.forgotten}</p>
            <p className="text-sm text-muted-foreground mt-1">不认识</p>
          </div>
        </div>
        <p className="text-muted-foreground text-sm">
          不认识的单词将在明天再次出现
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6 max-w-lg mx-auto w-full py-6">
      {/* 进度 */}
      <div className="w-full">
        <div className="flex justify-between text-sm text-muted-foreground mb-2">
          <span>{currentIndex + 1} / {words.length}</span>
          <span className="flex gap-3">
            <span className="text-green-600">✓ {results.remembered}</span>
            <span className="text-red-500">✗ {results.forgotten}</span>
          </span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* 闪卡 */}
      <div
        className="w-full cursor-pointer"
        style={{ perspective: "1000px" }}
        onClick={() => !flipped && setFlipped(true)}
      >
        <div
          className="relative w-full transition-transform duration-500"
          style={{
            transformStyle: "preserve-3d",
            transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
            minHeight: 260,
          }}
        >
          {/* 正面 */}
          <Card
            className="absolute inset-0 flex flex-col items-center justify-center p-8 gap-3"
            style={{ backfaceVisibility: "hidden" }}
          >
            <Badge variant="secondary" className="text-xs">
              第 {current.reviewStage === 0 ? "首次" : `${current.reviewStage}`} 次复习
            </Badge>
            <h2 className="text-4xl font-bold">{current.word}</h2>
            {current.phonetic && (
              <p className="text-muted-foreground">{current.phonetic}</p>
            )}
            <p className="text-sm text-muted-foreground mt-4">点击翻面查看释义</p>
          </Card>

          {/* 背面 */}
          <Card
            className="absolute inset-0 flex flex-col items-center justify-center p-8 gap-3"
            style={{
              backfaceVisibility: "hidden",
              transform: "rotateY(180deg)",
            }}
          >
            <h2 className="text-3xl font-bold mb-2">{current.word}</h2>
            {definitions.length > 0 ? (
              <div className="space-y-1.5 text-center">
                {definitions.map((d, i) => (
                  <p key={i} className="text-sm">
                    <span className="text-muted-foreground text-xs mr-1">{d.pos}.</span>
                    {d.def}
                  </p>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">暂无释义</p>
            )}
            {current.context && (
              <p className="text-xs text-muted-foreground italic mt-2 border-l-2 border-muted pl-2 text-left max-w-full">
                {current.context}
              </p>
            )}
          </Card>
        </div>
      </div>

      {/* 操作按钮 */}
      {flipped && (
        <div className="flex gap-4 w-full">
          <Button
            variant="outline"
            className="flex-1 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
            onClick={() => handleResult("forgotten")}
          >
            <XCircle className="h-4 w-4 mr-2" />
            不认识
          </Button>
          <Button
            className="flex-1 bg-green-600 hover:bg-green-700 text-white"
            onClick={() => handleResult("remembered")}
          >
            <CheckCircle2 className="h-4 w-4 mr-2" />
            认识
          </Button>
        </div>
      )}

      {!flipped && (
        <p className="text-xs text-muted-foreground">
          提示：也可以按 <kbd className="px-1.5 py-0.5 rounded border text-xs">Space</kbd> 键翻面
        </p>
      )}
    </div>
  );
}
