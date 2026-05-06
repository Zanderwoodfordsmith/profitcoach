"use client";

import { useMemo } from "react";
import { InsightDashboard } from "@/components/InsightDashboard";
import { buildPreviewInsights } from "@/lib/previewReportInsights";
import { buildFakeScores, getTotalScore } from "@/lib/bossScores";

export default function ReportPreviewPage() {
  const answers = useMemo(() => buildFakeScores(67), []);
  const totalScore = useMemo(() => getTotalScore(answers), [answers]);
  const insights = useMemo(() => buildPreviewInsights(), []);

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-8">
      <div className="mx-auto max-w-6xl space-y-4">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
          Preview: AI report dashboard
        </p>
        <InsightDashboard answers={answers} totalScore={totalScore} insights={insights} />
      </div>
    </div>
  );
}
