import { NextResponse } from "next/server";
import { requireOutreachCoach } from "@/lib/unipile/requireOutreachCoach";
import { loadCampaignActivityFeed } from "@/lib/unipile/campaignActivityFeed";

export async function GET(request: Request) {
  const auth = await requireOutreachCoach(request);
  if (auth.error || !auth.coachId) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }
  try {
    const feed = await loadCampaignActivityFeed(auth.coachId);
    return NextResponse.json(feed);
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Failed to load activity.",
      },
      { status: 500 }
    );
  }
}
