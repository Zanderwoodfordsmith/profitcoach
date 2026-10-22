import { NextResponse } from "next/server";
import { defaultProposalSections } from "@/lib/proposals/defaults";
import { loadProposalCoach, toProposal } from "@/lib/proposals/store";
import { PROPOSAL_COLUMNS } from "@/lib/proposals/types";
import { requireCoachRequest } from "@/lib/requireCoachRequest";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

/** The coach's proposals, newest first. */
export async function GET(request: Request) {
  const auth = await requireCoachRequest(request, { allowAdminSelf: true });
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: 401 });
  const { data, error } = await supabaseAdmin
    .from("coach_proposals")
    .select(PROPOSAL_COLUMNS)
    .eq("coach_id", auth.userId)
    .neq("status", "archived")
    .order("updated_at", { ascending: false })
    .limit(200);
  if (error) return NextResponse.json({ error: "Could not load proposals." }, { status: 500 });
  return NextResponse.json({ proposals: (data ?? []).map(toProposal) });
}

/** Start a proposal for one prospect, filled from the coach's Blueprint. */
export async function POST(request: Request) {
  const auth = await requireCoachRequest(request, { allowAdminSelf: true });
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: 401 });
  const body = (await request.json().catch(() => null)) as {
    prospect_name?: string;
    prospect_business?: string;
    prospect_email?: string;
    contact_id?: string;
  } | null;
  const name = body?.prospect_name?.trim().slice(0, 120);
  if (!name) return NextResponse.json({ error: "Add the prospect's name." }, { status: 400 });
  const business = body?.prospect_business?.trim().slice(0, 160) || null;
  const email = body?.prospect_email?.trim().toLowerCase().slice(0, 200) || null;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "That email doesn't look right." }, { status: 400 });
  }
  let contactId: string | null = null;
  if (body?.contact_id) {
    const { data: contact } = await supabaseAdmin.from("contacts").select("id").eq("id", body.contact_id).eq("coach_id", auth.userId).maybeSingle();
    contactId = (contact?.id as string | undefined) ?? null;
  }

  const coach = await loadProposalCoach(auth.userId);
  const { data, error } = await supabaseAdmin
    .from("coach_proposals")
    .insert({
      coach_id: auth.userId,
      contact_id: contactId,
      prospect_name: name,
      prospect_business: business,
      prospect_email: email,
      sections: defaultProposalSections({ coach, prospectName: name, prospectBusiness: business }),
    })
    .select(PROPOSAL_COLUMNS)
    .single();
  if (error) {
    console.error("proposal create:", error.message);
    return NextResponse.json({ error: "Could not start the proposal." }, { status: 500 });
  }
  return NextResponse.json({ proposal: toProposal(data) });
}
