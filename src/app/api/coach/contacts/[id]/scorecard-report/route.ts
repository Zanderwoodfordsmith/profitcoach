import type { User } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import {
  buildScorecardResult,
  type BossLevel,
  type ScorecardAnswers,
} from "@/lib/bossScorecardScores";
import type { QualifyingData } from "@/lib/bossScorecardQuestions";
import { splitFullName } from "@/lib/splitFullName";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type AuthFailure = { ok: false; error: string; status: number };

type AuthOk = {
  ok: true;
  user: User;
  profileRole: string;
  impersonateCoachId: string | null;
};

type AuthResult = AuthFailure | AuthOk;

async function authenticateCoachRequest(request: Request): Promise<AuthResult> {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : null;

  if (!token) {
    return { ok: false, error: "Missing access token.", status: 401 };
  }

  const {
    data: { user },
    error,
  } = await supabaseAdmin.auth.getUser(token);

  if (error || !user) {
    return { ok: false, error: "Invalid access token.", status: 401 };
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile || (profile.role !== "coach" && profile.role !== "admin")) {
    return { ok: false, error: "Not authorized.", status: 403 };
  }

  const impersonateCoachId =
    request.headers.get("x-impersonate-coach-id")?.trim() || null;

  return {
    ok: true,
    user,
    profileRole: profile.role as string,
    impersonateCoachId,
  };
}

function canAccessContact(
  auth: AuthOk,
  contactCoachId: string | null
): boolean {
  if (auth.profileRole === "coach") {
    return contactCoachId === auth.user.id;
  }
  if (auth.profileRole === "admin") {
    if (auth.impersonateCoachId) {
      return contactCoachId === auth.impersonateCoachId;
    }
    return true;
  }
  return false;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateCoachRequest(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id: contactId } = await context.params;

  const { data: contact, error: contactError } = await supabaseAdmin
    .from("contacts")
    .select(
      "id, coach_id, full_name, first_name, job_title, business_name, email"
    )
    .eq("id", contactId)
    .maybeSingle();

  if (contactError) {
    console.error("coach scorecard-report contact:", contactError);
    return NextResponse.json({ error: "Unable to load contact." }, { status: 500 });
  }

  if (!contact) {
    return NextResponse.json({ error: "Contact not found." }, { status: 404 });
  }

  if (!canAccessContact(auth, (contact.coach_id as string | null) ?? null)) {
    return NextResponse.json(
      { error: "You do not have access to this contact." },
      { status: 403 }
    );
  }

  const { data: row, error: assessError } = await supabaseAdmin
    .from("assessments")
    .select(
      "id, assessment_type, total_score, answers, qualifying_data, open_text, boss_level, completed_at, coach_id"
    )
    .eq("contact_id", contactId)
    .eq("assessment_type", "boss_scorecard")
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (assessError) {
    console.error("coach scorecard-report assessment:", assessError);
    return NextResponse.json({ error: "Could not load report." }, { status: 500 });
  }

  if (!row) {
    return NextResponse.json({ error: "No BOSS Score found." }, { status: 404 });
  }

  const coachId = (row.coach_id as string | null)?.trim() ?? "";
  const { data: coachRow } = coachId
    ? await supabaseAdmin.from("coaches").select("slug").eq("id", coachId).maybeSingle()
    : { data: null };

  const coachSlug = coachRow?.slug?.trim().toLowerCase() ?? "";

  const prospectFirstName =
    (contact.first_name as string | null)?.trim() ||
    splitFullName((contact.full_name as string | null) ?? "").first_name ||
    null;

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
    completed_at: row.completed_at,
    contact: {
      full_name: (contact.full_name as string) ?? "Unknown",
      job_title: (contact.job_title as string | null) ?? null,
      business_name: (contact.business_name as string | null) ?? null,
      email: (contact.email as string | null) ?? null,
    },
    result,
  });
}
