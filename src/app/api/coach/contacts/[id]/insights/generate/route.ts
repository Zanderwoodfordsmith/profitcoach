import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isMissingColumnError } from "@/lib/contactsSchemaSafeSelect";
import { generateInsights } from "@/lib/insightGenerator";
import type { AnswersMap } from "@/lib/bossScores";

type WorkshopAuthFailure = { ok: false; error: string; status: number };

type WorkshopAuthOk = {
  ok: true;
  userId: string;
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
    userId: user.id,
    profileRole: profile.role as string,
    impersonateCoachId,
  };
}

function canAccessContactForWorkshop(
  auth: WorkshopAuthOk,
  contactCoachId: string | null
): boolean {
  if (auth.profileRole === "coach") {
    return contactCoachId === auth.userId;
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

export async function POST(
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
    .select("id, coach_id, session_answers")
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

  let bodyAnswers: AnswersMap | null = null;
  try {
    const body = (await request.json().catch(() => ({}))) as { answers?: unknown };
    bodyAnswers = normalizeAnswers(body.answers);
  } catch {
    bodyAnswers = null;
  }

  const answers =
    bodyAnswers ?? normalizeAnswers((contact as { session_answers?: unknown }).session_answers);

  if (!answers) {
    return NextResponse.json(
      { error: "Score at least one playbook before generating insights." },
      { status: 400 }
    );
  }

  const insights = await generateInsights(answers);

  const { error: updateError } = await supabaseAdmin
    .from("contacts")
    .update({
      session_insights: insights,
      session_insights_generated_at: new Date().toISOString(),
    })
    .eq("id", contactId);

  if (updateError) {
    if (isMissingColumnError(updateError)) {
      return NextResponse.json(
        {
          error:
            "Apply Supabase migrations for contacts.session_insights, then retry.",
        },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: "Failed to save insights." }, { status: 500 });
  }

  return NextResponse.json({
    insights,
    insights_generated_at: new Date().toISOString(),
  });
}
