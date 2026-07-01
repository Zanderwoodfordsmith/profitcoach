import type { User } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import {
  buildBossProDashboardShareUrl,
  slugifyBusinessName,
} from "@/lib/bossProDashboardShareLink";
import { getAppBaseUrl } from "@/lib/appBaseUrl";
import { getTotalScore, type AnswersMap } from "@/lib/bossScores";
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

function normalizeAnswers(raw: unknown): AnswersMap | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const answers: AnswersMap = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof key !== "string") continue;
    if (value === 0 || value === 1 || value === 2) {
      answers[key] = value;
    }
  }
  return Object.keys(answers).length > 0 ? answers : null;
}

async function contactHasBossProSession(contactId: string, sessionAnswers: unknown) {
  if (normalizeAnswers(sessionAnswers)) return true;

  const { data: diagnosticRow } = await supabaseAdmin
    .from("assessments")
    .select("id")
    .eq("contact_id", contactId)
    .eq("assessment_type", "diagnostic_50")
    .limit(1)
    .maybeSingle();

  return Boolean(diagnosticRow);
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
      "id, coach_id, business_name, session_answers, dashboard_share_token"
    )
    .eq("id", contactId)
    .maybeSingle();

  if (contactError) {
    if (contactError.code === "42703" || contactError.code === "PGRST204") {
      return NextResponse.json(
        {
          error:
            "Dashboard sharing is not available yet. Apply the latest database migration.",
        },
        { status: 503 }
      );
    }
    console.error("coach dashboard-share-link contact:", contactError);
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

  const hasSession = await contactHasBossProSession(
    contactId,
    contact.session_answers
  );
  if (!hasSession) {
    return NextResponse.json(
      {
        error:
          "Record a Boss Pro session first — score this contact in Boss Pro, then share the link.",
      },
      { status: 404 }
    );
  }

  let shareToken = (contact.dashboard_share_token as string | null)?.trim() ?? "";
  if (!shareToken) {
    const { data: refreshed, error: refreshError } = await supabaseAdmin
      .from("contacts")
      .update({ dashboard_share_token: crypto.randomUUID() })
      .eq("id", contactId)
      .select("dashboard_share_token")
      .maybeSingle();

    if (refreshError || !refreshed?.dashboard_share_token) {
      console.error("coach dashboard-share-link token refresh:", refreshError);
      return NextResponse.json(
        { error: "Could not prepare share link." },
        { status: 500 }
      );
    }
    shareToken = refreshed.dashboard_share_token as string;
  }

  const coachId = (contact.coach_id as string | null)?.trim() ?? "";
  const { data: coachRow } = coachId
    ? await supabaseAdmin.from("coaches").select("slug").eq("id", coachId).maybeSingle()
    : { data: null };

  const coachSlug = coachRow?.slug?.trim().toLowerCase() ?? "";
  if (!coachSlug) {
    return NextResponse.json(
      { error: "Set your public URL slug in Settings before sharing a client dashboard link." },
      { status: 400 }
    );
  }

  const businessName = (contact.business_name as string | null) ?? null;
  const sessionAnswers = normalizeAnswers(contact.session_answers);
  const url = buildBossProDashboardShareUrl(
    coachSlug,
    businessName,
    shareToken,
    getAppBaseUrl(request)
  );

  return NextResponse.json({
    url,
    business_slug: slugifyBusinessName(businessName),
    coach_slug: coachSlug,
    has_session: true,
    total_score: sessionAnswers ? getTotalScore(sessionAnswers) : null,
  });
}
