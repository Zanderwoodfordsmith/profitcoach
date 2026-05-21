import { NextResponse } from "next/server";
import {
  buildScorecardResult,
  type BossLevel,
  type ScorecardAnswers,
} from "@/lib/bossScorecardScores";
import type { QualifyingData } from "@/lib/bossScorecardQuestions";
import { splitFullName } from "@/lib/splitFullName";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token")?.trim() ?? "";
  const coachSlugParam =
    new URL(request.url).searchParams.get("coach")?.trim().toLowerCase() ?? "";

  if (!token || !UUID_RE.test(token)) {
    return NextResponse.json({ error: "Invalid token" }, { status: 400 });
  }

  const { data: row, error } = await supabaseAdmin
    .from("assessments")
    .select(
      "id, assessment_type, total_score, answers, qualifying_data, open_text, boss_level, report_token, coach_id, contact_id"
    )
    .eq("report_token", token)
    .maybeSingle();

  if (error) {
    console.error("scorecard-report lookup:", error);
    return NextResponse.json({ error: "Could not load report" }, { status: 500 });
  }

  if (!row || row.assessment_type !== "boss_scorecard") {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }

  const coachId = (row.coach_id as string | null)?.trim() ?? "";
  if (!coachId) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }

  const { data: coachRow, error: coachError } = await supabaseAdmin
    .from("coaches")
    .select("slug")
    .eq("id", coachId)
    .maybeSingle();

  if (coachError) {
    console.error("scorecard-report coach lookup:", coachError);
    return NextResponse.json({ error: "Could not load report" }, { status: 500 });
  }

  const coachSlug = coachRow?.slug?.trim().toLowerCase() ?? "";
  if (!coachSlug) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }

  if (coachSlugParam && coachSlugParam !== coachSlug) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }

  let prospectFirstName: string | null = null;
  const contactId = (row.contact_id as string | null)?.trim() ?? "";
  if (contactId) {
    const { data: contactRow, error: contactError } = await supabaseAdmin
      .from("contacts")
      .select("full_name, first_name")
      .eq("id", contactId)
      .maybeSingle();

    if (contactError) {
      if (contactError.code === "42703") {
        const { data: fallbackContact } = await supabaseAdmin
          .from("contacts")
          .select("full_name")
          .eq("id", contactId)
          .maybeSingle();
        prospectFirstName =
          splitFullName(fallbackContact?.full_name ?? "").first_name || null;
      } else {
        console.error("scorecard-report contact lookup:", contactError);
      }
    } else {
      prospectFirstName =
        contactRow?.first_name?.trim() ||
        splitFullName(contactRow?.full_name ?? "").first_name ||
        null;
    }
  }

  const answers = (row.answers ?? {}) as ScorecardAnswers;
  const qualifying = (row.qualifying_data ?? {}) as QualifyingData;
  const result = buildScorecardResult(
    answers,
    qualifying,
    typeof row.open_text === "string" ? row.open_text : null,
    prospectFirstName
  );

  if (typeof row.boss_level === "string" && row.boss_level.trim()) {
    result.bossLevel = row.boss_level.trim() as BossLevel;
  }

  return NextResponse.json({
    coach_slug: coachSlug,
    result,
  });
}
