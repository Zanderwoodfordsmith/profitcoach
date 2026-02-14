import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

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

export async function GET(request: Request) {
  const authCheck = await requireAuth(request);
  if (authCheck.error) {
    return NextResponse.json(
      { error: authCheck.error ?? "Unauthorized" },
      { status: 401 }
    );
  }

  let resolvedContact: { id: string; full_name: string | null; email: string | null; business_name: string | null };

  if (authCheck.impersonateContactId) {
    const { data: contact, error: contactError } = await supabaseAdmin
      .from("contacts")
      .select("id, full_name, email, business_name, coach_id")
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

    resolvedContact = contact;
  } else {
    const { data: contact, error: contactError } = await supabaseAdmin
      .from("contacts")
      .select("id, full_name, email, business_name")
      .eq("user_id", authCheck.userId)
      .maybeSingle();

    if (contactError) {
      return NextResponse.json(
        { error: "Unable to load contact." },
        { status: 500 }
      );
    }

    if (!contact) {
      return NextResponse.json(
        { error: "No contact linked to your account." },
        { status: 404 }
      );
    }

    resolvedContact = contact;
  }

  const { data: latest, error: assessError } = await supabaseAdmin
    .from("assessments")
    .select("id, total_score, completed_at, answers")
    .eq("contact_id", resolvedContact.id)
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (assessError) {
    return NextResponse.json(
      { error: "Unable to load assessment." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    contact: {
      id: resolvedContact.id,
      full_name: resolvedContact.full_name,
      email: resolvedContact.email,
      business_name: resolvedContact.business_name,
    },
    assessment: latest
      ? {
          id: latest.id,
          total_score: latest.total_score,
          completed_at: latest.completed_at,
          answers: latest.answers ?? {},
        }
      : null,
  });
}
