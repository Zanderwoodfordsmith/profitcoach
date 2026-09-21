import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import type { CampaignStepInput } from "@/lib/unipile/campaigns";
import { replaceLibrarySteps } from "@/lib/campaignLibrary/store";

export const runtime = "nodejs";

export async function PUT(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request);
  if (auth.error || !auth.userId) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }
  const { id } = await ctx.params;
  let body: { steps?: CampaignStepInput[] };
  try {
    body = (await request.json()) as { steps?: CampaignStepInput[] };
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  if (!Array.isArray(body.steps)) {
    return NextResponse.json({ error: "steps must be an array." }, { status: 400 });
  }
  try {
    const steps = await replaceLibrarySteps(id, body.steps);
    return NextResponse.json({ steps });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error.";
    if (message === "Not found.") {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    console.error("admin/campaign-library/[id]/steps PUT", err);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
