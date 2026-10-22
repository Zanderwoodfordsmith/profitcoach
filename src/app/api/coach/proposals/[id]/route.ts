import { NextResponse } from "next/server";
import { proposalUrl } from "@/lib/proposals/send";
import { loadCoachProposal, toProposal } from "@/lib/proposals/store";
import { cleanSections, PROPOSAL_COLUMNS } from "@/lib/proposals/types";
import { requireCoachRequest } from "@/lib/requireCoachRequest";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Ctx) {
  const auth = await requireCoachRequest(request, { allowAdminSelf: true });
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: 401 });
  const proposal = await loadCoachProposal(auth.userId, (await params).id);
  if (!proposal) return NextResponse.json({ error: "Proposal not found." }, { status: 404 });
  const { data: profile } = await supabaseAdmin.from("profiles").select("full_name").eq("id", auth.userId).maybeSingle();
  return NextResponse.json({ proposal, url: proposalUrl(proposal.share_token), coach_name: (profile?.full_name as string | null) ?? "" });
}

/** Save edits: prospect details, sections, or archive. A signed proposal is locked. */
export async function PATCH(request: Request, { params }: Ctx) {
  const auth = await requireCoachRequest(request, { allowAdminSelf: true });
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: 401 });
  const current = await loadCoachProposal(auth.userId, (await params).id);
  if (!current) return NextResponse.json({ error: "Proposal not found." }, { status: 404 });
  if (current.status === "signed") return NextResponse.json({ error: "This proposal is signed, so it can't change." }, { status: 409 });

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Nothing to save." }, { status: 400 });
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.prospect_name === "string") {
    const name = body.prospect_name.trim().slice(0, 120);
    if (!name) return NextResponse.json({ error: "Add the prospect's name." }, { status: 400 });
    update.prospect_name = name;
  }
  if (typeof body.prospect_business === "string") update.prospect_business = body.prospect_business.trim().slice(0, 160) || null;
  if (typeof body.prospect_email === "string") {
    const email = body.prospect_email.trim().toLowerCase().slice(0, 200);
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "That email doesn't look right." }, { status: 400 });
    update.prospect_email = email || null;
  }
  if (body.sections !== undefined) {
    const sections = cleanSections(body.sections);
    if (!sections.length) return NextResponse.json({ error: "The proposal needs at least one section." }, { status: 400 });
    update.sections = sections;
  }
  if (body.archive === true) update.status = "archived";

  const { data, error } = await supabaseAdmin
    .from("coach_proposals")
    .update(update)
    .eq("id", current.id)
    .eq("coach_id", auth.userId)
    .neq("status", "signed")
    .select(PROPOSAL_COLUMNS)
    .maybeSingle();
  if (error || !data) return NextResponse.json({ error: "Could not save." }, { status: 500 });
  return NextResponse.json({ proposal: toProposal(data) });
}
