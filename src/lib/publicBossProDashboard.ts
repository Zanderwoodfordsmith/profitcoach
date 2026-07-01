import { getTotalScore, type AnswersMap } from "@/lib/bossScores";
import type { StoredInsights } from "@/lib/insightGenerator";
import { slugifyBusinessName } from "@/lib/bossProDashboardShareLink";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

function readStoredInsights(value: unknown): StoredInsights | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (!record.overallShort || typeof record.overallShort !== "object") return null;
  return value as StoredInsights;
}

async function resolveSessionAnswers(
  contactId: string,
  sessionAnswers: unknown
): Promise<AnswersMap | null> {
  const fromSession = normalizeAnswers(sessionAnswers);
  if (fromSession) return fromSession;

  const { data: diagnosticRow } = await supabaseAdmin
    .from("assessments")
    .select("answers")
    .eq("contact_id", contactId)
    .eq("assessment_type", "diagnostic_50")
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!diagnosticRow) return null;
  return normalizeAnswers((diagnosticRow as { answers?: unknown }).answers);
}

export type PublicBossProDashboardPayload = {
  coach_slug: string;
  coach_name: string | null;
  coach_calendar_embed_code: string | null;
  business_slug: string;
  contact: {
    full_name: string;
    business_name: string | null;
  };
  answers: AnswersMap;
  total_score: number;
  session_insights: StoredInsights | null;
};

export async function loadPublicBossProDashboard(params: {
  token: string;
  coachSlugParam: string;
  businessSlugParam: string;
}): Promise<
  | { ok: true; data: PublicBossProDashboardPayload }
  | { ok: false; error: string; status: number }
> {
  const token = params.token.trim();
  const coachSlugParam = params.coachSlugParam.trim().toLowerCase();
  const businessSlugParam = params.businessSlugParam.trim().toLowerCase();

  if (!token || !UUID_RE.test(token)) {
    return { ok: false, error: "Invalid token", status: 400 };
  }

  if (!coachSlugParam) {
    return { ok: false, error: "Invalid link", status: 400 };
  }

  const contactSelect =
    "id, full_name, business_name, coach_id, session_answers, session_insights, dashboard_share_token";

  let contactRow: Record<string, unknown> | null = null;

  const primary = await supabaseAdmin
    .from("contacts")
    .select(contactSelect)
    .eq("dashboard_share_token", token)
    .maybeSingle();

  if (primary.error) {
    if (primary.error.code === "42703" || primary.error.code === "PGRST204") {
      return {
        ok: false,
        error: "Dashboard sharing is not available yet. Apply the latest database migration.",
        status: 503,
      };
    }
    console.error("public boss-pro-dashboard contact lookup:", primary.error);
    return { ok: false, error: "Could not load dashboard", status: 500 };
  }

  contactRow = primary.data as Record<string, unknown> | null;

  if (!contactRow) {
    return { ok: false, error: "Dashboard not found", status: 404 };
  }

  const coachId = (contactRow.coach_id as string | null)?.trim() ?? "";
  if (!coachId) {
    return { ok: false, error: "Dashboard not found", status: 404 };
  }

  const { data: coachRow, error: coachError } = await supabaseAdmin
    .from("coaches")
    .select("slug, calendar_embed_code, profiles(full_name)")
    .eq("id", coachId)
    .maybeSingle();

  if (coachError) {
    console.error("public boss-pro-dashboard coach lookup:", coachError);
    return { ok: false, error: "Could not load dashboard", status: 500 };
  }

  const coachSlug = coachRow?.slug?.trim().toLowerCase() ?? "";
  if (!coachSlug || coachSlug !== coachSlugParam) {
    return { ok: false, error: "Dashboard not found", status: 404 };
  }

  const businessName = (contactRow.business_name as string | null) ?? null;
  const expectedBusinessSlug = slugifyBusinessName(businessName);
  if (businessSlugParam && businessSlugParam !== expectedBusinessSlug) {
    return { ok: false, error: "Dashboard not found", status: 404 };
  }

  const contactId = contactRow.id as string;
  const answers = await resolveSessionAnswers(
    contactId,
    contactRow.session_answers
  );

  if (!answers) {
    return {
      ok: false,
      error: "No Boss Pro session has been recorded for this contact yet.",
      status: 404,
    };
  }

  const total_score = getTotalScore(answers);
  const profiles = coachRow?.profiles as { full_name?: string | null } | null;

  return {
    ok: true,
    data: {
      coach_slug: coachSlug,
      coach_name: profiles?.full_name?.trim() || null,
      coach_calendar_embed_code:
        (coachRow?.calendar_embed_code as string | null)?.trim() || null,
      business_slug: expectedBusinessSlug,
      contact: {
        full_name: (contactRow.full_name as string)?.trim() || "Client",
        business_name: businessName,
      },
      answers,
      total_score,
      session_insights: readStoredInsights(contactRow.session_insights),
    },
  };
}
