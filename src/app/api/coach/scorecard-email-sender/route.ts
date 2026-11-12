import { NextResponse } from "next/server";
import { requireCoachRequest } from "@/lib/requireCoachRequest";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  loadScorecardEmailSender,
  reviewCallName,
  type ScorecardEmailSender,
} from "@/lib/scorecardFollowUp";

export const runtime = "nodejs";

/** The playbooks the app sends after a BOSS Score or BOSS Pro (job 214). */
const SEQUENCE_PLAYBOOKS = [
  "scorecard-incomplete",
  "scorecard-complete",
  "scorecard-pro-incomplete",
  "scorecard-pro-complete",
];

async function coachId(request: Request) {
  const auth = await requireCoachRequest(request, { allowAdminSelf: true });
  if (auth.error || !auth.userId) return { error: auth.error ?? "Unauthorized" };
  return { id: auth.userId };
}

async function emailAccountLabel(id: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("linkedin_outreach_accounts")
    .select("provider, status, display_name")
    .eq("coach_id", id)
    .in("provider", ["GOOGLE", "OUTLOOK", "MAIL", "EXCHANGE"]);
  const ok = (data ?? []).find((row) => String(row.status || "").toUpperCase() === "OK");
  if (!ok) return null;
  return (ok.display_name as string | null)?.trim() || "your email";
}

async function state(id: string) {
  const [sender, emailAccount, callName] = await Promise.all([
    loadScorecardEmailSender(id),
    emailAccountLabel(id),
    reviewCallName(id),
  ]);
  return { ...sender, emailAccount, callName };
}

export async function GET(request: Request) {
  const who = await coachId(request);
  if (!who.id) return NextResponse.json({ error: who.error }, { status: 401 });
  return NextResponse.json(await state(who.id));
}

export async function PUT(request: Request) {
  const who = await coachId(request);
  if (!who.id) return NextResponse.json({ error: who.error }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { sender?: string };
  const sender = body.sender as ScorecardEmailSender;
  if (sender !== "app" && sender !== "crm") {
    return NextResponse.json({ error: "Choose app or crm." }, { status: 400 });
  }
  const { error } = await supabaseAdmin
    .from("coaches")
    .update({ scorecard_email_sender: sender })
    .eq("id", who.id);
  if (error) return NextResponse.json({ error: "Could not save." }, { status: 500 });

  // Old CRM takes over: stop the app's sequences so nobody gets both.
  // Switching to the app starts each sequence when the next person comes through.
  if (sender === "crm") {
    const { data: camps } = await supabaseAdmin
      .from("linkedin_campaigns")
      .select("id")
      .eq("coach_id", who.id)
      .in("source_playbook_id", SEQUENCE_PLAYBOOKS)
      .eq("status", "running");
    const { setCampaignStatus } = await import("@/lib/unipile/campaigns");
    for (const c of camps ?? []) {
      await setCampaignStatus(who.id, c.id as string, "paused");
    }
  }
  return NextResponse.json(await state(who.id));
}
