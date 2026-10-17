import { NextResponse } from "next/server";
import { checkCampaignById } from "@/lib/campaigns/launchCheck";
import { requireOutreachCoach } from "@/lib/unipile/requireOutreachCoach";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

/** Pre-launch check: things that would break (blockers) or likely cost replies (warnings). */
export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireOutreachCoach(request);
  if (auth.error || !auth.coachId) return NextResponse.json({ error: auth.error ?? "Not authorised." }, { status: 401 });
  const { id } = await ctx.params;
  const { data: owned } = await supabaseAdmin
    .from("linkedin_campaigns")
    .select("id")
    .eq("id", id)
    .eq("coach_id", auth.coachId)
    .maybeSingle();
  if (!owned) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const issues = await checkCampaignById(auth.coachId, id);
  return NextResponse.json({ issues });
}
