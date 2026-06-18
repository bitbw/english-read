"use client";

import { StudyStatsPanel } from "@/components/dashboard/study-stats-panel";

type StatsPageClientProps = {
  title: string;
  backLabel: string;
};

export function StatsPageClient({ title, backLabel }: StatsPageClientProps) {
  return (
    <StudyStatsPanel
      title={title}
      backHref="/dashboard"
      backLabel={backLabel}
      statsEndpoint="/api/stats/study"
    />
  );
}
