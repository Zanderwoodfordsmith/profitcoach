import type { User } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getTotalScore } from "@/lib/bossScores";

const PILLAR_KEYS = ["foundation", "vision", "velocity", "value"] as const;
type PillarKey = (typeof PILLAR_KEYS)[number];

type AnswersMap = Record<string, 0 | 1 | 2>;

type WorkshopAuthFailure = { ok: false; error: string; status: number };

type WorkshopAuthOk = {
  ok: true;
  user: User;
  profileRole: string;
  impersonateCoachId: string | null;
};

type WorkshopAuth = WorkshopAuthFailure | WorkshopAuthOk;

async function authenticateWorkshopSession(request: Request): Promise<WorkshopAuth> {
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

function canAccessContactForWorkshop(
  auth: WorkshopAuthOk,
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

/** Coach id stored on new assessments; null if contact has no coach (cannot insert answers). */
function coachIdForAssessmentWrites(
  auth: WorkshopAuthOk,
  contactCoachId: string | null
): string | null {
  if (auth.profileRole === "coach") {
    return auth.user.id;
  }
  if (auth.profileRole === "admin") {
    if (auth.impersonateCoachId) {
      return auth.impersonateCoachId;
    }
    return contactCoachId;
  }
  return null;
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
  return answers;
}

function normalizePillarNotes(raw: unknown): Partial<Record<PillarKey, string>> | null {
  if (raw === undefined) return null;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const out: Partial<Record<PillarKey, string>> = {};
  for (const k of PILLAR_KEYS) {
    const v = (raw as Record<string, unknown>)[k];
    if (typeof v === "string") out[k] = v;
  }
  return Object.keys(out).length ? out : {};
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateWorkshopSession(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id: contactId } = await context.params;

  const { data: contact, error: contactError } = await supabaseAdmin
    .from("contacts")
    .select("id, full_name, email, business_name, coach_id, pillar_session_notes")
    .eq("id", contactId)
    .maybeSingle();

  if (contactError || !contact) {
    return NextResponse.json({ error: "Contact not found." }, { status: 404 });
  }

  if (!canAccessContactForWorkshop(auth, contact.coach_id as string | null)) {
    return NextResponse.json(
      { error: "You do not have access to this contact." },
      { status: 403 }
    );
  }

  const { data: latest, error: assessError } = await supabaseAdmin
    .from("assessments")
    .select("id, total_score, completed_at, answers")
    .eq("contact_id", contactId)
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (assessError) {
    return NextResponse.json(
      { error: "Unable to load latest assessment." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    contact: {
      id: contact.id as string,
      full_name: contact.full_name as string,
      email: (contact.email as string | null) ?? null,
      business_name: (contact.business_name as string | null) ?? null,
      coach_id: (contact.coach_id as string | null) ?? null,
      pillar_session_notes: contact.pillar_session_notes ?? null,
    },
    assessment: latest
      ? {
          id: latest.id as string,
          total_score: latest.total_score as number,
          completed_at: latest.completed_at as string,
          answers: (latest.answers ?? {}) as AnswersMap,
        }
      : null,
  });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateWorkshopSession(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id: contactId } = await context.params;

  const { data: contact, error: contactError } = await supabaseAdmin
    .from("contacts")
    .select("id, coach_id")
    .eq("id", contactId)
    .maybeSingle();

  if (contactError || !contact) {
    return NextResponse.json({ error: "Contact not found." }, { status: 404 });
  }

  if (!canAccessContactForWorkshop(auth, contact.coach_id as string | null)) {
    return NextResponse.json(
      { error: "You do not have access to this contact." },
      { status: 403 }
    );
  }

  const coachWriteId = coachIdForAssessmentWrites(auth, contact.coach_id as string | null);

  let body: { answers?: unknown; pillarNotes?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const answersPatch = normalizeAnswers(body.answers);
  const pillarNotesPatch = normalizePillarNotes(body.pillarNotes);

  if (!answersPatch && pillarNotesPatch === null) {
    return NextResponse.json(
      { error: "Provide answers and/or pillarNotes." },
      { status: 400 }
    );
  }

  if (answersPatch && !coachWriteId) {
    return NextResponse.json(
      {
        error:
          "This contact has no assigned coach; assign a coach before saving scores.",
      },
      { status: 400 }
    );
  }

  if (pillarNotesPatch && Object.keys(pillarNotesPatch).length > 0) {
    const { data: existing, error: readNotesError } = await supabaseAdmin
      .from("contacts")
      .select("pillar_session_notes")
      .eq("id", contactId)
      .maybeSingle();

    if (readNotesError) {
      return NextResponse.json(
        { error: "Failed to load notes." },
        { status: 500 }
      );
    }

    const prev =
      (existing?.pillar_session_notes as Record<string, string> | null) ?? {};
    const merged = { ...prev, ...pillarNotesPatch };

    const { error: notesError } = await supabaseAdmin
      .from("contacts")
      .update({ pillar_session_notes: merged })
      .eq("id", contactId);

    if (notesError) {
      return NextResponse.json(
        { error: "Failed to save pillar notes." },
        { status: 500 }
      );
    }
  }

  let assessmentOut: {
    id: string;
    total_score: number;
    answers: AnswersMap;
    completed_at: string;
  } | null = null;

  if (answersPatch && coachWriteId) {
    const total_score = getTotalScore(answersPatch);
    if (total_score < 0 || total_score > 100) {
      return NextResponse.json(
        { error: "Invalid total score from answers." },
        { status: 400 }
      );
    }

    const { data: latest, error: fetchError } = await supabaseAdmin
      .from("assessments")
      .select("id")
      .eq("contact_id", contactId)
      .order("completed_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fetchError) {
      return NextResponse.json(
        { error: "Unable to load assessment." },
        { status: 500 }
      );
    }

    if (latest?.id) {
      const { error: updateError } = await supabaseAdmin
        .from("assessments")
        .update({ answers: answersPatch, total_score })
        .eq("id", latest.id as string);

      if (updateError) {
        return NextResponse.json(
          { error: "Failed to update assessment." },
          { status: 500 }
        );
      }

      const { data: row } = await supabaseAdmin
        .from("assessments")
        .select("id, total_score, answers, completed_at")
        .eq("id", latest.id as string)
        .maybeSingle();

      if (row) {
        assessmentOut = {
          id: row.id as string,
          total_score: row.total_score as number,
          answers: (row.answers ?? {}) as AnswersMap,
          completed_at: row.completed_at as string,
        };
      }
    } else {
      const { data: inserted, error: insertError } = await supabaseAdmin
        .from("assessments")
        .insert({
          coach_id: coachWriteId,
          contact_id: contactId,
          source: "coach_session",
          total_score,
          answers: answersPatch,
          completed_at: new Date().toISOString(),
        })
        .select("id, total_score, answers, completed_at")
        .single();

      if (insertError || !inserted) {
        return NextResponse.json(
          { error: "Failed to create assessment." },
          { status: 500 }
        );
      }

      assessmentOut = {
        id: inserted.id as string,
        total_score: inserted.total_score as number,
        answers: (inserted.answers ?? {}) as AnswersMap,
        completed_at: inserted.completed_at as string,
      };
    }
  }

  return NextResponse.json({
    ok: true,
    assessment: assessmentOut,
  });
}
