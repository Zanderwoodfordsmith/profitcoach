import { NextResponse } from "next/server";
import { requireOutreachCoach } from "@/lib/unipile/requireOutreachCoach";
import { listCoachCampaignTemplates } from "@/lib/campaignLibrary/instantiate";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await requireOutreachCoach(request);
  if (auth.error || !auth.coachId) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }
  try {
    const templates = await listCoachCampaignTemplates();
    return NextResponse.json({ templates });
  } catch (err) {
    console.error("coach/linkedin-outreach/campaign-templates GET", err);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
