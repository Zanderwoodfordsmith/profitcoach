import { NextResponse } from "next/server";
import { reorderCoachCampaigns } from "@/lib/unipile/campaignListPlacement";
import { requireOutreachCoach } from "@/lib/unipile/requireOutreachCoach";

const CAMPAIGN_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const auth = await requireOutreachCoach(request);
  if (auth.error || !auth.coachId) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { ids?: unknown };
  const ids = body.ids;
  if (
    !Array.isArray(ids) ||
    ids.length === 0 ||
    ids.length > 200 ||
    ids.some((id) => typeof id !== "string" || !CAMPAIGN_ID.test(id)) ||
    new Set(ids).size !== ids.length
  ) {
    return NextResponse.json({ error: "Invalid campaign order." }, { status: 400 });
  }

  try {
    await reorderCoachCampaigns(auth.coachId, ids);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not save order.";
    const status = message === "Campaign not found." ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
