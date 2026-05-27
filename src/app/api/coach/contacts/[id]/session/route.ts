import type { User } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { PLAYBOOKS } from "@/lib/bossData";
import { isPlaybookSessionNotesKey } from "@/lib/playbookSessionNotes";
import {
  CONTACTS_SESSION_NOTES_MIGRATION_HINT,
  isMissingColumnError,
  loadContactForWorkshopSession,
} from "@/lib/contactsSchemaSafeSelect";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getTotalScore } from "@/lib/bossScores";

const VALID_PLAYBOOK_REFS = new Set(PLAYBOOKS.map((p) => p.ref));

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

type SessionPayload = {
  answers: AnswersMap;
  total_score: number;
};

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

function sessionFromAnswers(raw: unknown): SessionPayload | null {
  const answers = normalizeAnswers(raw);
  if (!answers || Object.keys(answers).length === 0) return null;
  return { answers, total_score: getTotalScore(answers) };
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

function normalizePlaybookNotes(
  raw: unknown
): Partial<Record<string, string>> | null {
  if (raw === undefined) return null;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const out: Partial<Record<string, string>> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v !== "string") continue;
    if (isPlaybookSessionNotesKey(k, VALID_PLAYBOOK_REFS)) out[k] = v;
  }
  return out;
}

async function mergeContactJsonNotes(
  contactId: string,
  column: "pillar_session_notes" | "playbook_session_notes",
  patch: Partial<Record<string, string>>
): Promise<{ error: string | null }> {
  const { data: existing, error: readNotesError } = await supabaseAdmin
    .from("contacts")
    .select("pillar_session_notes, playbook_session_notes")
    .eq("id", contactId)
    .maybeSingle();

  if (readNotesError) {
    return {
      error: isMissingColumnError(readNotesError)
        ? CONTACTS_SESSION_NOTES_MIGRATION_HINT
        : "Failed to load notes.",
    };
  }

  const prev =
    (existing?.[column] as Record<string, string> | null | undefined) ?? {};
  const merged = { ...prev, ...patch };

  const { error: notesError } = await supabaseAdmin
    .from("contacts")
    .update({ [column]: merged })
    .eq("id", contactId);

  if (notesError) {
    return {
      error: isMissingColumnError(notesError)
        ? CONTACTS_SESSION_NOTES_MIGRATION_HINT
        : column === "pillar_session_notes"
          ? "Failed to save pillar notes."
          : "Failed to save playbook notes.",
    };
  }

  return { error: null };
}

async function saveSessionAnswers(
  contactId: string,
  answers: AnswersMap
): Promise<{ session: SessionPayload | null; error: string | null }> {
  const total_score = getTotalScore(answers);
  if (total_score < 0 || total_score > 100) {
    return { session: null, error: "Invalid total score from answers." };
  }

  const { error: updateError } = await supabaseAdmin
    .from("contacts")
    .update({ session_answers: answers })
    .eq("id", contactId);

  if (updateError) {
    return {
      session: null,
      error: isMissingColumnError(updateError)
        ? CONTACTS_SESSION_NOTES_MIGRATION_HINT
        : "Failed to save session scores.",
    };
  }

  return { session: { answers, total_score }, error: null };
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

  const { contact, error: contactError } =
    await loadContactForWorkshopSession(contactId);

  if (contactError) {
    console.error("coach/contacts session GET contact:", contactError);
    return NextResponse.json(
      {
        error: isMissingColumnError(contactError)
          ? CONTACTS_SESSION_NOTES_MIGRATION_HINT
          : "Unable to load contact.",
      },
      { status: 500 }
    );
  }

  if (!contact) {
    return NextResponse.json({ error: "Contact not found." }, { status: 404 });
  }

  if (!canAccessContactForWorkshop(auth, contact.coach_id as string | null)) {
    return NextResponse.json(
      { error: "You do not have access to this contact." },
      { status: 403 }
    );
  }

  let session = sessionFromAnswers(contact.session_answers);

  if (!session) {
    const { data: diagnosticRow } = await supabaseAdmin
      .from("assessments")
      .select("answers, total_score, completed_at")
      .eq("contact_id", contactId)
      .eq("assessment_type", "diagnostic_50")
      .order("completed_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (diagnosticRow) {
      session = sessionFromAnswers(
        (diagnosticRow as { answers?: unknown }).answers
      );
    }
  }

  return NextResponse.json({
    contact: {
      id: contact.id as string,
      full_name: contact.full_name as string,
      email: (contact.email as string | null) ?? null,
      business_name: (contact.business_name as string | null) ?? null,
      coach_id: (contact.coach_id as string | null) ?? null,
      pillar_session_notes: contact.pillar_session_notes ?? null,
      playbook_session_notes: contact.playbook_session_notes ?? null,
      session_insights: contact.session_insights ?? null,
      session_insights_generated_at: contact.session_insights_generated_at ?? null,
    },
    session,
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

  let body: { answers?: unknown; pillarNotes?: unknown; playbookNotes?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const answersPatch = normalizeAnswers(body.answers);
  const pillarNotesPatch = normalizePillarNotes(body.pillarNotes);
  const playbookNotesPatch = normalizePlaybookNotes(body.playbookNotes);

  if (
    !answersPatch &&
    pillarNotesPatch === null &&
    playbookNotesPatch === null
  ) {
    return NextResponse.json(
      { error: "Provide answers, pillarNotes, and/or playbookNotes." },
      { status: 400 }
    );
  }

  if (pillarNotesPatch) {
    const { error } = await mergeContactJsonNotes(
      contactId,
      "pillar_session_notes",
      pillarNotesPatch
    );
    if (error) {
      return NextResponse.json({ error }, { status: 500 });
    }
  }

  if (playbookNotesPatch) {
    const { error } = await mergeContactJsonNotes(
      contactId,
      "playbook_session_notes",
      playbookNotesPatch
    );
    if (error) {
      return NextResponse.json({ error }, { status: 500 });
    }
  }

  let sessionOut: SessionPayload | null = null;

  if (answersPatch) {
    const { session, error } = await saveSessionAnswers(contactId, answersPatch);
    if (error) {
      return NextResponse.json({ error }, { status: 500 });
    }
    sessionOut = session;
  }

  return NextResponse.json({
    ok: true,
    session: sessionOut,
  });
}
