import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { buildSystemMessage, getAssistantReply, type SectionContext } from "@/lib/coachAi";

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

export async function POST(request: Request) {
  const authCheck = await requireAuth(request);
  if (authCheck.error) {
    return NextResponse.json({ error: authCheck.error }, { status: 401 });
  }

  const resolved = await resolveContactId(authCheck);
  if ("error" in resolved) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  }
  const contactId = resolved.contactId;

  const body = await request.json().catch(() => ({}));
  const chatId = typeof body.chatId === "string" ? body.chatId.trim() || undefined : undefined;
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const sectionContext = body.sectionContext as SectionContext | undefined;

  if (!message) {
    return NextResponse.json({ error: "Message is required." }, { status: 400 });
  }

  // Load system prompt
  const { data: promptRow, error: promptError } = await supabaseAdmin
    .from("coach_ai_prompt")
    .select("system_prompt")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const basePrompt = promptRow?.system_prompt ?? "You are a supportive business coach. Be warm, direct, and practical.";
  const systemMessage = buildSystemMessage(basePrompt, sectionContext);

  // #region agent log
  fetch("http://127.0.0.1:7242/ingest/bba1adf9-ecf5-4171-8b75-fa8976277b63", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      location: "coach-chat/route.ts:after load prompt",
      message: "Prompt load result",
      data: {
        hasPromptRow: !!promptRow,
        promptError: promptError?.message ?? null,
        basePromptPreview: (basePrompt ?? "").slice(0, 120),
        basePromptLength: (basePrompt ?? "").length,
        systemMessagePreview: (systemMessage ?? "").slice(0, 120),
        hasSectionContext: !!sectionContext,
      },
      timestamp: Date.now(),
      hypothesisId: "H1-H3",
    }),
  }).catch(() => {});
  // #endregion

  let activeChatId: string;
  let existingMessages: { role: string; content: string }[] = [];

  if (chatId) {
    const { data: chat, error: chatError } = await supabaseAdmin
      .from("coach_chats")
      .select("id")
      .eq("id", chatId)
      .eq("contact_id", contactId)
      .maybeSingle();

    if (chatError || !chat) {
      return NextResponse.json({ error: "Chat not found." }, { status: 404 });
    }
    activeChatId = chat.id as string;

    const { data: rows } = await supabaseAdmin
      .from("coach_chat_messages")
      .select("role, content")
      .eq("chat_id", activeChatId)
      .order("created_at", { ascending: true });
    existingMessages = (rows ?? []).map((r) => ({ role: r.role, content: r.content }));
  } else {
    const { data: newChat, error: insertError } = await supabaseAdmin
      .from("coach_chats")
      .insert({
        contact_id: contactId,
        section_context: sectionContext ?? null,
        updated_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (insertError || !newChat) {
      console.error("coach-chat create chat error:", insertError);
      return NextResponse.json({ error: "Failed to create chat." }, { status: 500 });
    }
    activeChatId = newChat.id as string;
  }

  const messagesForApi = [
    ...existingMessages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    { role: "user" as const, content: message },
  ];

  const result = await getAssistantReply(systemMessage, messagesForApi);

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  const now = new Date().toISOString();

  const { error: insertUserError } = await supabaseAdmin.from("coach_chat_messages").insert({
    chat_id: activeChatId,
    role: "user",
    content: message,
    created_at: now,
  });
  if (insertUserError) {
    console.error("coach-chat insert user message error:", insertUserError);
  }

  const { error: insertAssistantError } = await supabaseAdmin.from("coach_chat_messages").insert({
    chat_id: activeChatId,
    role: "assistant",
    content: result.content,
    created_at: now,
  });
  if (insertAssistantError) {
    console.error("coach-chat insert assistant message error:", insertAssistantError);
  }

  await supabaseAdmin
    .from("coach_chats")
    .update({ updated_at: now })
    .eq("id", activeChatId);

  return NextResponse.json({
    chatId: activeChatId,
    userMessage: { role: "user", content: message },
    assistantMessage: { role: "assistant", content: result.content },
  });
}
