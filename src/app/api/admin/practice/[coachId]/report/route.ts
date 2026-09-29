import { NextResponse } from "next/server";

import { generateCampaignJson } from "@/lib/firstCampaign/generateJson";
import { loadCoachLinkedInSummary } from "@/lib/firstCampaign/loadCoachContext";
import { requireAdmin } from "@/lib/requireAdmin";
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

function parseCoachId(raw: string): string | null {
  const id = raw.trim();
  return /^[0-9a-f-]{36}$/i.test(id) ? id : null;
}

export async function POST(
  request: Request,
  ctx: { params: Promise<{ coachId: string }> }
) {
  const auth = await requireAdmin(request);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }
  const { coachId: raw } = await ctx.params;
  const coachId = parseCoachId(raw);
  if (!coachId) return NextResponse.json({ error: "Not found." }, { status: 404 });

  try {
    const knowledge = await ensurePracticeKnowledge(coachId);
    const { summary } = await loadCoachLinkedInSummary(coachId);
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
      coachId,
      report: data,
      status: knowledge.status === "capturing" ? "extracted" : knowledge.status,
    });
    return NextResponse.json({
      report: next.report_payload,
      generated_at: next.report_generated_at,
      knowledge: next,
    });
  } catch (err) {
    console.error("admin practice report:", err instanceof Error ? err.message : "failed");
    return NextResponse.json({ error: "Could not generate the report." }, { status: 500 });
  }
}
