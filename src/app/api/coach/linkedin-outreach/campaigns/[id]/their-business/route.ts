import { NextResponse } from "next/server";
import { theirBusinessDetailsForLead } from "@/lib/campaigns/theirBusiness";
import { requireOutreachCoach } from "@/lib/unipile/requireOutreachCoach";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

const PAGE = 10;

/** "Business type and location" for a few real people in the campaign, so the coach sees how the note reads. */
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

  const offset = Math.max(0, Number(new URL(request.url).searchParams.get("offset")) || 0);
  const { data: leads, count, error } = await supabaseAdmin
    .from("linkedin_campaign_leads")
    .select("id, company", { count: "exact" })
    .eq("campaign_id", id)
    .eq("coach_id", auth.coachId)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true })
    .range(offset, offset + PAGE - 1);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const people = await Promise.all(
    (leads ?? []).map(async (lead) => ({
      id: lead.id as string,
      company: (lead.company as string | null) ?? "",
      ...(await theirBusinessDetailsForLead(lead.id as string)),
    }))
  );
  return NextResponse.json({ people, total: count ?? 0, next: offset + PAGE < (count ?? 0) ? offset + PAGE : null });
}
