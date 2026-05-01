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
  { params }: { params: Promise<{ chatId: string }> }
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

  const { chatId } = await params;

  const { data: chat, error: chatError } = await supabaseAdmin
    .from("coach_chats")
    .select("id, title, section_context, folder_id, created_at, updated_at")
    .eq("id", chatId)
    .eq("contact_id", contactId)
    .maybeSingle();

  if (chatError || !chat) {
    return NextResponse.json({ error: "Chat not found." }, { status: 404 });
  }

  const { data: messages, error: msgError } = await supabaseAdmin
    .from("coach_chat_messages")
    .select("id, role, content, created_at")
    .eq("chat_id", chatId)
    .order("created_at", { ascending: true });

  if (msgError) {
    console.error("coach-chats/[chatId] GET messages error:", msgError);
    return NextResponse.json({ error: "Unable to load messages." }, { status: 500 });
  }

  return NextResponse.json({
    chat: {
      id: chat.id,
      title: chat.title ?? null,
      section_context: chat.section_context ?? null,
      folder_id: chat.folder_id ?? null,
      created_at: chat.created_at,
      updated_at: chat.updated_at,
    },
    messages: (messages ?? []).map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      created_at: m.created_at,
    })),
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ chatId: string }> }
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
  const { chatId } = await params;

  const body = await request.json().catch(() => ({}));
  const title = typeof body.title === "string" ? body.title.trim() : null;
  let folderId: string | null | undefined = undefined;
  if (body.folder_id !== undefined) {
    folderId = body.folder_id === null ? null : (typeof body.folder_id === "string" ? body.folder_id.trim() || null : null);
  }
  let isFavourite: boolean | undefined;
  if (typeof body.is_favourite === "boolean") isFavourite = body.is_favourite;
  let favouriteSortOrder: number | null | undefined;
  if (body.favourite_sort_order !== undefined) {
    favouriteSortOrder = typeof body.favourite_sort_order === "number" ? body.favourite_sort_order : null;
  }

  const { data: chat, error: fetchError } = await supabaseAdmin
    .from("coach_chats")
    .select("id")
    .eq("id", chatId)
    .eq("contact_id", contactId)
    .maybeSingle();

  if (fetchError || !chat) {
    return NextResponse.json({ error: "Chat not found." }, { status: 404 });
  }

  if (folderId !== undefined && folderId !== null) {
    const { data: folder, error: folderError } = await supabaseAdmin
      .from("coach_chat_folders")
      .select("id")
      .eq("id", folderId)
      .eq("contact_id", contactId)
      .maybeSingle();
    if (folderError || !folder) {
      return NextResponse.json({ error: "Folder not found." }, { status: 404 });
    }
  }

  const updates: {
    title?: string | null;
    folder_id?: string | null;
    is_favourite?: boolean;
    favourite_sort_order?: number | null;
    updated_at: string;
  } = {
    updated_at: new Date().toISOString(),
  };
  if (title !== undefined) updates.title = title || null;
  if (folderId !== undefined) updates.folder_id = folderId;
  if (isFavourite !== undefined) {
    updates.is_favourite = isFavourite;
    if (!isFavourite) updates.favourite_sort_order = null;
    else if (favouriteSortOrder === undefined) {
      const { data: maxRow } = await supabaseAdmin
        .from("coach_chats")
        .select("favourite_sort_order")
        .eq("contact_id", contactId)
        .eq("is_favourite", true)
        .order("favourite_sort_order", { ascending: false })
        .limit(1)
        .maybeSingle();
      const next = (maxRow?.favourite_sort_order ?? -1) + 1;
      updates.favourite_sort_order = next;
    }
  }
  if (favouriteSortOrder !== undefined) updates.favourite_sort_order = favouriteSortOrder;

  const { error: updateError } = await supabaseAdmin
    .from("coach_chats")
    .update(updates)
    .eq("id", chatId);

  if (updateError) {
    console.error("coach-chats PATCH error:", updateError);
    return NextResponse.json({ error: "Unable to update chat." }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    ...(title !== undefined && { title: title || null }),
    ...(folderId !== undefined && { folder_id: folderId }),
    ...(isFavourite !== undefined && { is_favourite: isFavourite }),
    ...(favouriteSortOrder !== undefined && { favourite_sort_order: favouriteSortOrder }),
  });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ chatId: string }> }
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
  const { chatId } = await params;

  const { data: chat, error: fetchError } = await supabaseAdmin
    .from("coach_chats")
    .select("id")
    .eq("id", chatId)
    .eq("contact_id", contactId)
    .maybeSingle();

  if (fetchError || !chat) {
    return NextResponse.json({ error: "Chat not found." }, { status: 404 });
  }

  const { error: deleteError } = await supabaseAdmin.from("coach_chats").delete().eq("id", chatId);

  if (deleteError) {
    console.error("coach-chats DELETE error:", deleteError);
    return NextResponse.json({ error: "Unable to delete chat." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
