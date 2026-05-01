import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

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

async function resolveContactId(auth: AuthResult): Promise<{ contactId: string } | { error: string; status: number }> {
  if (auth.error || !auth.userId) {
    return { error: auth.error ?? "Unauthorized", status: 401 };
  }

  if (auth.impersonateContactId) {
    const { data: contact, error: contactError } = await supabaseAdmin
      .from("contacts")
      .select("id, coach_id")
      .eq("id", auth.impersonateContactId)
      .maybeSingle();

    if (contactError || !contact) {
      return { error: "Contact not found.", status: 404 };
    }
    if (auth.role === "coach" && contact.coach_id !== auth.userId) {
      return { error: "You do not have access to this contact.", status: 403 };
    }
    return { contactId: contact.id as string };
  }

  const { data: contact, error: contactError } = await supabaseAdmin
    .from("contacts")
    .select("id")
    .eq("user_id", auth.userId)
    .maybeSingle();

  if (contactError || !contact) {
    return { error: "Unable to load contact.", status: 500 };
  }
  return { contactId: contact.id as string };
}

export async function GET(request: Request) {
  const authCheck = await requireAuth(request);
  if (authCheck.error) {
    return NextResponse.json({ error: authCheck.error }, { status: 401 });
  }

  const resolved = await resolveContactId(authCheck);
  if ("error" in resolved) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  }
  const contactId = resolved.contactId;

  const { data: chats, error } = await supabaseAdmin
    .from("coach_chats")
    .select("id, title, section_context, folder_id, is_favourite, favourite_sort_order, created_at, updated_at")
    .eq("contact_id", contactId)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("coach-chats GET error:", error);
    return NextResponse.json({ error: "Unable to load chats." }, { status: 500 });
  }

  const list = (chats ?? []).map((c) => ({
    id: c.id,
    title: c.title ?? null,
    section_context: c.section_context ?? null,
    folder_id: c.folder_id ?? null,
    is_favourite: c.is_favourite ?? false,
    favourite_sort_order: c.favourite_sort_order ?? null,
    created_at: c.created_at,
    updated_at: c.updated_at,
  }));

  return NextResponse.json({ chats: list });
}
