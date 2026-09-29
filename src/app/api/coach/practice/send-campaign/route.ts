import { NextResponse } from "next/server";

import { requireCoachRequest } from "@/lib/requireCoachRequest";
import { campaignStepsFromSection, type HandoffVariant } from "@/lib/practiceKnowledge/campaignHandoff";
import { ensurePracticeKnowledge } from "@/lib/practiceKnowledge/store";
import { createCampaign, replaceCampaignSteps } from "@/lib/unipile/campaigns";

/**
 * Creates a DRAFT Get Clients campaign from the blueprint's campaign messaging.
 * Nothing sends until the coach (or BCA) adds prospects and starts it.
 */
export async function POST(request: Request) {
  const check = await requireCoachRequest(request, { allowAdminSelf: true });
  if (check.error || !check.userId) {
    return NextResponse.json({ error: check.error ?? "Unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as { variant?: string };
  const variant: HandoffVariant = body.variant === "conversation" ? "conversation" : "connector";

  try {
    const row = await ensurePracticeKnowledge(check.userId);
    const section = row.built_sections["campaigns:messaging"];
    if (!section) {
      return NextResponse.json({ error: "Write the campaign messaging first." }, { status: 400 });
    }
    const plan = campaignStepsFromSection(section, variant);
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
