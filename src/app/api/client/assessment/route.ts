import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getTotalScore } from "@/lib/bossScores";

type AuthResult =
  | { error: "Missing access token." | "Invalid access token." | "Not authorized as client."; userId: null; role: null; impersonateContactId: null }
  | { error: null; userId: string; role: "client"; impersonateContactId: null }
  | { error: null; userId: string; role: "admin" | "coach"; impersonateContactId: string };

async function requireAuth(request: Request): Promise<AuthResult> {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : null;

  if (!token) {
    return { error: "Missing access token." as const, userId: null, role: null, impersonateContactId: null };
  }

  const {
    data: { user },
    error,
  } = await supabaseAdmin.auth.getUser(token);

  if (error || !user) {
    return { error: "Invalid access token." as const, userId: null, role: null, impersonateContactId: null };
  }

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const role = profile?.role ?? null;
  const impersonateContactId = request.headers.get("x-impersonate-contact-id")?.trim() || null;

  if (impersonateContactId && (role === "admin" || role === "coach")) {
    return { error: null, userId: user.id as string, role, impersonateContactId };
  }

  if (!profile || role !== "client") {
    return { error: "Not authorized as client." as const, userId: null, role: null, impersonateContactId: null };
  }

  return { error: null, userId: user.id as string, role: "client", impersonateContactId: null };
}

type AnswersMap = Record<string, 0 | 1 | 2>;

export async function PATCH(request: Request) {
  const authCheck = await requireAuth(request);
  if (authCheck.error) {
    return NextResponse.json(
      { error: authCheck.error ?? "Unauthorized" },
      { status: 401 }
    );
  }

  let contactId: string;

  if (authCheck.impersonateContactId) {
    const { data: contact, error: contactError } = await supabaseAdmin
      .from("contacts")
      .select("id, coach_id")
      .eq("id", authCheck.impersonateContactId)
      .maybeSingle();

    if (contactError || !contact) {
      return NextResponse.json(
        { error: "Contact not found." },
        { status: 404 }
      );
    }

    if (authCheck.role === "coach" && contact.coach_id !== authCheck.userId) {
      return NextResponse.json(
        { error: "You do not have access to this contact." },
        { status: 403 }
      );
    }

    contactId = contact.id as string;
  } else {
    const { data: contact, error: contactError } = await supabaseAdmin
      .from("contacts")
      .select("id")
      .eq("user_id", authCheck.userId)
      .maybeSingle();

    if (contactError || !contact) {
      return NextResponse.json(
        { error: "Unable to load contact." },
        { status: 500 }
      );
    }

    contactId = contact.id as string;
  }

  let body: { answers?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400 }
    );
  }

  const rawAnswers = body.answers;
  if (!rawAnswers || typeof rawAnswers !== "object" || Array.isArray(rawAnswers)) {
    return NextResponse.json(
      { error: "Body must include answers object." },
      { status: 400 }
    );
  }

  const answers: AnswersMap = {};
  for (const [key, value] of Object.entries(rawAnswers)) {
    if (typeof key !== "string") continue;
    if (value === 0 || value === 1 || value === 2) {
      answers[key] = value;
    }
  }

  const total_score = getTotalScore(answers);
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

  if (fetchError || !latest) {
    return NextResponse.json(
      { error: "No assessment found to update." },
      { status: 404 }
    );
  }

  const { error: updateError } = await supabaseAdmin
    .from("assessments")
    .update({ answers, total_score })
    .eq("id", latest.id);

  if (updateError) {
    return NextResponse.json(
      { error: "Failed to update assessment." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    id: latest.id,
    total_score,
    answers,
  });
}
