import { NextResponse } from "next/server";
import { requireOutreachCoach } from "@/lib/unipile/requireOutreachCoach";
import { createCampaign, listCampaigns } from "@/lib/unipile/campaigns";

export async function GET(request: Request) {
  const auth = await requireOutreachCoach(request);
  if (auth.error || !auth.coachId) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }
  try {
    const campaigns = await listCampaigns(auth.coachId);
    return NextResponse.json({ campaigns });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to list campaigns." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireOutreachCoach(request);
  if (auth.error || !auth.coachId) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    name?: string;
    outreach_account_id?: string | null;
  };
  try {
    const campaign = await createCampaign(auth.coachId, {
      name: body.name || "Untitled campaign",
      outreach_account_id: body.outreach_account_id ?? null,
    });
    return NextResponse.json({ campaign });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Create failed." },
      { status: 500 }
    );
  }
}
