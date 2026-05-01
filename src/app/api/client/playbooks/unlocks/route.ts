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

  const { searchParams } = new URL(request.url);
  const contactIdParam = searchParams.get("contact_id");

  let contactId: string;

  if (authCheck.impersonateContactId) {
    const { data: contact } = await supabaseAdmin
      .from("contacts")
      .select("id, coach_id")
      .eq("id", authCheck.impersonateContactId)
      .maybeSingle();

    if (!contact) {
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

    contactId = contact.id;
  } else {
    if (!contactIdParam) {
      return NextResponse.json(
        { error: "Missing contact_id" },
        { status: 400 }
      );
    }

    const { data: contact } = await supabaseAdmin
      .from("contacts")
      .select("id")
      .eq("id", contactIdParam)
      .eq("user_id", authCheck.userId)
      .maybeSingle();

    if (!contact) {
      return NextResponse.json(
        { error: "Contact not found or not linked to your account." },
        { status: 404 }
      );
    }

    contactId = contact.id;
  }

  const { data: rows } = await supabaseAdmin
    .from("client_playbook_unlocks")
    .select("playbook_ref, status")
    .eq("contact_id", contactId);

  const unlocks = (rows ?? [])
    .filter((r) => {
      const s = r.status as string | undefined;
      if (s === undefined || s === null) return true;
      return s === "in_progress" || s === "implemented";
    })
    .map((r) => r.playbook_ref as string);

  return NextResponse.json({ unlocks });
}
