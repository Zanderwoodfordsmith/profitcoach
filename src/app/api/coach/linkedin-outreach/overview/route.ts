import { NextResponse } from "next/server";
import { requireOutreachCoach } from "@/lib/unipile/requireOutreachCoach";
import { loadCampaignOverview } from "@/lib/unipile/campaignOverview";

export async function GET(request: Request) {
  const auth = await requireOutreachCoach(request);
  if (auth.error || !auth.coachId) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  try {
    const overview = await loadCampaignOverview(
      auth.coachId,
      searchParams.get("range"),
      searchParams.get("offset")
    );
    return NextResponse.json(overview);
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to load overview.",
      },
      { status: 500 }
    );
  }
}
