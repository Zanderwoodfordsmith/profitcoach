import { NextResponse } from "next/server";

import { generateCampaignJson } from "@/lib/firstCampaign/generateJson";
import { loadCoachLinkedInSummary } from "@/lib/firstCampaign/loadCoachContext";
import { requireCoachRequest } from "@/lib/requireCoachRequest";
import {
  PRACTICE_REPORT_SYSTEM,
  summarizeKnowledgeForPrompt,
} from "@/lib/practiceKnowledge/prompts";
import {
  ensurePracticeKnowledge,
  patchPracticeKnowledge,
} from "@/lib/practiceKnowledge/store";
import type { PracticeReportPayload } from "@/lib/practiceKnowledge/types";

export const maxDuration = 60;

export async function GET(request: Request) {
  const check = await requireCoachRequest(request, { allowAdminSelf: true });
  if (check.error || !check.userId) {
    return NextResponse.json({ error: check.error ?? "Unauthorized" }, { status: 401 });
  }
  const knowledge = await ensurePracticeKnowledge(check.userId);
  return NextResponse.json({
    report: knowledge.report_payload,
    generated_at: knowledge.report_generated_at,
  });
}

export async function POST(request: Request) {
  const check = await requireCoachRequest(request, { allowAdminSelf: true });
  if (check.error || !check.userId) {
    return NextResponse.json({ error: check.error ?? "Unauthorized" }, { status: 401 });
  }

  try {
    const knowledge = await ensurePracticeKnowledge(check.userId);
    const { summary } = await loadCoachLinkedInSummary(check.userId);
    const { data, error } = await generateCampaignJson<PracticeReportPayload>({
      system: PRACTICE_REPORT_SYSTEM,
      user: [
        "## LinkedIn",
        summary.slice(0, 4000),
        "",
        "## Knowledge",
        summarizeKnowledgeForPrompt(knowledge.payload),
      ].join("\n"),
      maxTokens: 2500,
    });
    if (!data) {
      return NextResponse.json(
        { error: error || "Could not generate the report." },
        { status: 502 }
      );
    }
    const next = await patchPracticeKnowledge({
      coachId: check.userId,
      report: data,
      status:
        knowledge.status === "capturing" ? "extracted" : knowledge.status,
    });
    return NextResponse.json({
      report: next.report_payload,
      generated_at: next.report_generated_at,
      knowledge: next,
    });
  } catch (err) {
    console.error("practice report:", err instanceof Error ? err.message : "failed");
    return NextResponse.json({ error: "Could not generate the report." }, { status: 500 });
  }
}
