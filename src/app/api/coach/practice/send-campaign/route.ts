import { NextResponse } from "next/server";

import { requireCoachRequest } from "@/lib/requireCoachRequest";
import { campaignPlan, handoffById, handoffForSection } from "@/lib/practiceKnowledge/campaignHandoff";
import { sectionByKey } from "@/lib/practiceKnowledge/blueprint";
import { ensurePracticeKnowledge } from "@/lib/practiceKnowledge/store";
import { createCampaign, replaceCampaignSteps } from "@/lib/unipile/campaigns";

/**
 * Creates a DRAFT Get Clients campaign from one written Blueprint campaign.
 * Nothing sends until the coach (or BCA) adds prospects and starts it.
 */
export async function POST(request: Request) {
  const check = await requireCoachRequest(request, { allowAdminSelf: true });
  if (check.error || !check.userId) {
    return NextResponse.json({ error: check.error ?? "Unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as { section?: string; variant?: string };
  // `variant` is the older body ("connector" or "conversation"), kept for open tabs.
  const handoff =
    (typeof body.section === "string" ? handoffForSection(body.section) : null) ??
    handoffById(typeof body.variant === "string" ? body.variant : "connection");
  if (!handoff) {
    return NextResponse.json({ error: "That section does not go to Get Clients." }, { status: 400 });
  }

  try {
    const row = await ensurePracticeKnowledge(check.userId);
    const section = row.built_sections[handoff.section];
    if (!section) {
      const title = sectionByKey(handoff.section)?.section.title ?? "the campaign";
      return NextResponse.json({ error: `Write the ${title.toLowerCase()} first.` }, { status: 400 });
    }
    const plan = campaignPlan(handoff, section);
    if (!plan) {
      return NextResponse.json({ error: "No messages found for that campaign. Rewrite the section and try again." }, { status: 400 });
    }
    const campaign = await createCampaign(check.userId, { name: plan.name, channel: "linkedin" });
    await replaceCampaignSteps(campaign.id as string, plan.steps);
    return NextResponse.json({ campaign_id: campaign.id, name: plan.name, steps: plan.steps.length });
  } catch (err) {
    console.error("practice send-campaign:", err instanceof Error ? err.message : "failed");
    return NextResponse.json({ error: "Could not create the draft campaign." }, { status: 500 });
  }
}
