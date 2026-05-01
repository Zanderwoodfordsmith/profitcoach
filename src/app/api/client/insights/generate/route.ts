import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { generateInsights } from "@/lib/insightGenerator";
import type { AnswersMap } from "@/lib/bossScores";

type AuthResult =
  | { error: "Missing access token." | "Invalid access token." | "Not authorized as client."; userId: null; role: null; impersonateContactId: null }
  | { error: null; userId: string; role: "client"; impersonateContactId: null }
  | { error: null; userId: string; role: "admin" | "coach"; impersonateContactId: string };

async function requireAuth(request: Request): Promise<AuthResult> {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null;

  if (!token) {
    return { error: "Missing access token." as const, userId: null, role: null, impersonateContactId: null };
  }

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
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

export async function POST(request: Request) {
  const authCheck = await requireAuth(request);
  if (authCheck.error) {
    return NextResponse.json({ error: authCheck.error ?? "Unauthorized" }, { status: 401 });
  }

  let contactId: string;

  if (authCheck.impersonateContactId) {
    const { data: contact, error: contactError } = await supabaseAdmin
      .from("contacts")
      .select("id, coach_id")
      .eq("id", authCheck.impersonateContactId)
      .maybeSingle();

    if (contactError || !contact) {
      return NextResponse.json({ error: "Contact not found." }, { status: 404 });
    }
    if (authCheck.role === "coach" && contact.coach_id !== authCheck.userId) {
      return NextResponse.json({ error: "You do not have access to this contact." }, { status: 403 });
    }
    contactId = contact.id as string;
  } else {
    const { data: contact, error: contactError } = await supabaseAdmin
      .from("contacts")
      .select("id")
      .eq("user_id", authCheck.userId)
      .maybeSingle();

    if (contactError || !contact) {
      return NextResponse.json({ error: "Unable to load contact." }, { status: 500 });
    }
    contactId = contact.id as string;
  }

  const { data: latest, error: fetchError } = await supabaseAdmin
    .from("assessments")
    .select("id, answers")
    .eq("contact_id", contactId)
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ error: "Failed to load assessment." }, { status: 500 });
  }
  if (!latest) {
    return NextResponse.json({ error: "No assessment found." }, { status: 404 });
  }

  const answers = (latest.answers ?? {}) as AnswersMap;
  const insights = await generateInsights(answers);

  const { error: updateError } = await supabaseAdmin
    .from("assessments")
    .update({
      insights,
      insights_generated_at: new Date().toISOString(),
    })
    .eq("id", latest.id);

  if (updateError) {
    return NextResponse.json({ error: "Failed to save insights." }, { status: 500 });
  }

  return NextResponse.json({ insights });
}
