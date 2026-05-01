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

export async function GET(
  request: Request,
  { params }: { params: Promise<{ folderId: string }> }
) {
  const authCheck = await requireAuth(request);
  if (authCheck.error) {
    return NextResponse.json({ error: authCheck.error }, { status: 401 });
  }

  const resolved = await resolveContactId(authCheck);
  if ("error" in resolved) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  }
  const contactId = resolved.contactId;
  const { folderId } = await params;

  const { data: folder, error } = await supabaseAdmin
    .from("coach_chat_folders")
    .select("id, parent_id, name, sort_order, created_at, updated_at")
    .eq("id", folderId)
    .eq("contact_id", contactId)
    .maybeSingle();

  if (error || !folder) {
    return NextResponse.json({ error: "Folder not found." }, { status: 404 });
  }

  return NextResponse.json({
    id: folder.id,
    parent_id: folder.parent_id ?? null,
    name: folder.name,
    sort_order: folder.sort_order,
    created_at: folder.created_at,
    updated_at: folder.updated_at,
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ folderId: string }> }
) {
  const authCheck = await requireAuth(request);
  if (authCheck.error) {
    return NextResponse.json({ error: authCheck.error }, { status: 401 });
  }

  const resolved = await resolveContactId(authCheck);
  if ("error" in resolved) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  }
  const contactId = resolved.contactId;
  const { folderId } = await params;

  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";

  if (!name) {
    return NextResponse.json({ error: "Name is required." }, { status: 400 });
  }

  const { data: folder, error: fetchError } = await supabaseAdmin
    .from("coach_chat_folders")
    .select("id")
    .eq("id", folderId)
    .eq("contact_id", contactId)
    .maybeSingle();

  if (fetchError || !folder) {
    return NextResponse.json({ error: "Folder not found." }, { status: 404 });
  }

  const { error: updateError } = await supabaseAdmin
    .from("coach_chat_folders")
    .update({ name, updated_at: new Date().toISOString() })
    .eq("id", folderId);

  if (updateError) {
    console.error("coach-chat-folders PATCH error:", updateError);
    return NextResponse.json({ error: "Unable to update folder." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, name });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ folderId: string }> }
) {
  const authCheck = await requireAuth(request);
  if (authCheck.error) {
    return NextResponse.json({ error: authCheck.error }, { status: 401 });
  }

  const resolved = await resolveContactId(authCheck);
  if ("error" in resolved) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  }
  const contactId = resolved.contactId;
  const { folderId } = await params;

  const { data: folder, error: fetchError } = await supabaseAdmin
    .from("coach_chat_folders")
    .select("id, parent_id")
    .eq("id", folderId)
    .eq("contact_id", contactId)
    .maybeSingle();

  if (fetchError || !folder) {
    return NextResponse.json({ error: "Folder not found." }, { status: 404 });
  }

  const { data: childFolders } = await supabaseAdmin
    .from("coach_chat_folders")
    .select("id")
    .eq("parent_id", folderId);

  if (childFolders && childFolders.length > 0) {
    return NextResponse.json(
      { error: "Remove or move subfolders first before deleting this folder." },
      { status: 400 }
    );
  }

  const newFolderId = folder.parent_id ?? null;
  const { error: updateChatsError } = await supabaseAdmin
    .from("coach_chats")
    .update({ folder_id: newFolderId })
    .eq("folder_id", folderId);

  if (updateChatsError) {
    console.error("coach-chat-folders DELETE update chats error:", updateChatsError);
    return NextResponse.json({ error: "Unable to delete folder." }, { status: 500 });
  }

  const { error: deleteError } = await supabaseAdmin
    .from("coach_chat_folders")
    .delete()
    .eq("id", folderId);

  if (deleteError) {
    console.error("coach-chat-folders DELETE error:", deleteError);
    return NextResponse.json({ error: "Unable to delete folder." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
