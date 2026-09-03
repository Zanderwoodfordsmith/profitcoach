import { NextResponse } from "next/server";
import { requireOutreachCoach } from "@/lib/unipile/requireOutreachCoach";
import {
  advanceLeadFunnel,
  listInterestQueue,
  logLeadInterest,
  type FunnelStatus,
  type InterestOutcome,
} from "@/lib/unipile/interest";
import {
  OUTREACH_PLAYBOOKS,
  REPLY_PLAYBOOK_SNIPPETS,
} from "@/lib/unipile/playbooks";
import { buildLeadAssessmentUrl } from "@/lib/unipile/interest";

/** Interest queue + playbook catalog for coaches. */
export async function GET(request: Request) {
  const auth = await requireOutreachCoach(request);
  if (auth.error || !auth.coachId) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }
  try {
    const url = new URL(request.url);
    const view = url.searchParams.get("view") || "queue";
    if (view === "playbooks") {
      return NextResponse.json({
        playbooks: OUTREACH_PLAYBOOKS.map((p) => ({
          id: p.id,
          name: p.name,
          channel: p.channel,
          description: p.description,
          northStar: p.northStar,
          step_count: p.steps.length,
        })),
        reply_snippets: REPLY_PLAYBOOK_SNIPPETS,
      });
    }
    const queue = await listInterestQueue(auth.coachId);
    const assessment_url = await buildLeadAssessmentUrl({
      coachId: auth.coachId,
    });
    return NextResponse.json({
      queue,
      assessment_url,
      north_star: "interested_reply",
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Load failed." },
      { status: 500 }
    );
  }
}

/** Log interest or advance funnel on a lead. */
export async function POST(request: Request) {
  const auth = await requireOutreachCoach(request);
  if (auth.error || !auth.coachId) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    action?: string;
    lead_id?: string;
    outcome?: InterestOutcome;
    note?: string;
    status?: FunnelStatus;
  };
  if (!body.lead_id?.trim()) {
    return NextResponse.json({ error: "lead_id required." }, { status: 400 });
  }
  try {
    if (body.action === "funnel" && body.status) {
      const lead = await advanceLeadFunnel({
        coachId: auth.coachId,
        leadId: body.lead_id,
        status: body.status,
        note: body.note,
      });
      return NextResponse.json({ ok: true, lead });
    }
    if (!body.outcome) {
      return NextResponse.json({ error: "outcome required." }, { status: 400 });
    }
    const lead = await logLeadInterest({
      coachId: auth.coachId,
      leadId: body.lead_id,
      outcome: body.outcome,
      note: body.note,
      status: body.status,
    });
    return NextResponse.json({ ok: true, lead });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Update failed." },
      { status: 500 }
    );
  }
}
