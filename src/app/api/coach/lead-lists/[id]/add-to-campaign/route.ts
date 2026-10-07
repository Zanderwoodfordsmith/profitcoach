import { NextResponse } from "next/server";
import { requireCoachRequest } from "@/lib/requireCoachRequest";
import {
  addLeadListToCampaign,
  AddListToCampaignError,
} from "@/lib/leadLists/addListToCampaign";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: Ctx) {
  const auth = await requireCoachRequest(request, { allowAdminSelf: true });
  if (auth.error || !auth.userId) {
    return NextResponse.json({ error: auth.error ?? "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;

  const body = (await request.json().catch(() => ({}))) as {
    campaign_id?: string;
    item_ids?: unknown;
    all?: boolean;
  };

  try {
    const result = await addLeadListToCampaign({
      coachId: auth.userId,
      listId: id,
      campaignId: typeof body.campaign_id === "string" ? body.campaign_id.trim() : "",
      itemIds: Array.isArray(body.item_ids)
        ? body.item_ids.filter((value): value is string => typeof value === "string")
        : [],
      all: body.all === true,
    });
    return NextResponse.json({
      added: result.added,
      skipped: result.skipped,
      blacklisted: result.blacklisted,
    });
  } catch (err) {
    if (err instanceof AddListToCampaignError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not add to campaign." },
      { status: 500 }
    );
  }
}
