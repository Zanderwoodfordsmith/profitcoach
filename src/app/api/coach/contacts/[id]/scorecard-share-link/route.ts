import { NextResponse } from "next/server";
import { buildScorecardReportUrl } from "@/lib/scorecardReportLink";
import { requireShareCoach } from "@/lib/shareLinks/requireShareCoach";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireShareCoach(request);
  if (auth.error || !auth.coachId) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const { id: contactId } = await context.params;
  if (!UUID_RE.test(contactId)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const { data: contact, error: contactError } = await supabaseAdmin
    .from("contacts")
    .select("id, coach_id")
    .eq("id", contactId)
    .maybeSingle();

  if (contactError) {
    return NextResponse.json({ error: "Unable to load contact." }, { status: 500 });
  }
  if (!contact || contact.coach_id !== auth.coachId) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const { data: row, error: assessError } = await supabaseAdmin
    .from("assessments")
    .select("report_token")
    .eq("contact_id", contactId)
    .eq("assessment_type", "boss_scorecard")
    .not("completed_at", "is", null)
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (assessError) {
    return NextResponse.json({ error: "Could not load report." }, { status: 500 });
  }

  const token = (row?.report_token as string | null)?.trim() ?? "";
  if (!token) {
    return NextResponse.json(
      { error: "They haven’t completed a Boss Score yet." },
      { status: 404 }
    );
  }

  const { data: coach } = await supabaseAdmin
    .from("coaches")
    .select("slug")
    .eq("id", auth.coachId)
    .maybeSingle();
  const slug = coach?.slug?.trim() ?? "";
  if (!slug) {
    return NextResponse.json(
      { error: "Set your public URL before sharing reports." },
      { status: 400 }
    );
  }

  return NextResponse.json({
    url: buildScorecardReportUrl(slug, token),
  });
}
