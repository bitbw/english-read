import type { ReactNode } from "react";

export type VocabularyDefRow = { pos: string; def: string; zh?: string };

export function parseVocabularyDefinitions(definition: string | null): VocabularyDefRow[] {
  if (!definition) return [];
  try {
    return JSON.parse(definition) as VocabularyDefRow[];
  } catch {
    return [];
  }
}

interface VocabularyDefinitionViewProps {
  definition: string | null;
  /** 与 WordCard 一致：无有效 JSON 时显示 */
  emptyFallback?: ReactNode;
  className?: string;
}

export function VocabularyDefinitionView({
  definition,
  emptyFallback = null,
  className,
}: VocabularyDefinitionViewProps) {
  const definitions = parseVocabularyDefinitions(definition);
  const translateRow = definitions.find((d) => d.pos === "译");
  const nonTranslate = definitions.filter((d) => d.pos !== "译");
  const chineseLine = translateRow ? (translateRow.zh ?? translateRow.def) : "";

  if (definitions.length === 0) {
    return <>{emptyFallback}</>;
  }

  return (
    <div className={className}>
      <div className="space-y-1">
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
    </div>
  );
}
