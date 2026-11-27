import { NextResponse } from "next/server";
import { requireOutreachCoach } from "@/lib/unipile/requireOutreachCoach";
import {
  listCoachCampaignTemplates,
  saveCampaignAsTemplate,
} from "@/lib/campaignLibrary/instantiate";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await requireOutreachCoach(request);
  if (auth.error || !auth.coachId) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }
  try {
    const templates = await listCoachCampaignTemplates(auth.coachId);
    return NextResponse.json({ templates });
  } catch (err) {
    console.error("coach/linkedin-outreach/campaign-templates GET", err);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}

/** Save one of the coach's campaigns as their own template. */
export async function POST(request: Request) {
  const auth = await requireOutreachCoach(request);
  if (auth.error || !auth.coachId) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    campaign_id?: unknown;
    name?: unknown;
  };
  if (typeof body.campaign_id !== "string" || !body.campaign_id.trim()) {
    return NextResponse.json({ error: "Pick a campaign." }, { status: 400 });
  }
  try {
    const template = await saveCampaignAsTemplate(
      auth.coachId,
      body.campaign_id.trim(),
      typeof body.name === "string" ? body.name.slice(0, 200) : ""
    );
    return NextResponse.json({ template });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error.";
    if (message === "Campaign not found.") {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    if (message.startsWith("Add a step")) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    console.error("coach/linkedin-outreach/campaign-templates POST", err);
    return NextResponse.json({ error: "Could not save the template." }, { status: 500 });
  }
}
