import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/requireAdmin";
import { DEFAULT_SUPPORT_ASSIGNEE_ID } from "@/lib/support/assignees";
import { conversationChatPath } from "@/lib/support/chatPages";
import { sendSupportCreatedTicketEmail } from "@/lib/support/notifyCoachOfReply";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * BCA coaching a coach on one of their prospect conversations (16 Nov, job 224).
 * GET: who the coach is and the prospect's latest message, to fill the box.
 * POST: start a Support chat with the coach about it. The coach is emailed as
 * for any chat BCA starts, and the chat's button opens the conversation.
 */

const UUID = /^[0-9a-f-]{36}$/i;

async function loadConversation(id: string) {
  const { data } = await supabaseAdmin
    .from("messaging_conversations")
    .select("id, coach_id, contact_id, prospect_name")
    .eq("id", id)
    .maybeSingle();
  return data as
    | { id: string; coach_id: string; contact_id: string | null; prospect_name: string | null }
    | null;
}

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: 401 });

  const id = new URL(request.url).searchParams.get("conversation_id")?.trim() ?? "";
  if (!UUID.test(id)) return NextResponse.json({ error: "Which conversation?" }, { status: 400 });
  const conversation = await loadConversation(id);
  if (!conversation) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });

  // The inbox shows one person's threads as one, so look across them all.
  let threadIds = [conversation.id];
  if (conversation.contact_id) {
    const { data: same } = await supabaseAdmin
      .from("messaging_conversations")
      .select("id")
      .eq("coach_id", conversation.coach_id)
      .eq("contact_id", conversation.contact_id);
    threadIds = Array.from(new Set([conversation.id, ...(same ?? []).map((r) => r.id as string)]));
  }

  const [{ data: coach }, { data: latest }] = await Promise.all([
    supabaseAdmin
      .from("profiles")
      .select("first_name, full_name")
      .eq("id", conversation.coach_id)
      .maybeSingle(),
    supabaseAdmin
      .from("messaging_messages")
      .select("body_text")
      .in("conversation_id", threadIds)
      .eq("direction", "inbound")
      .neq("channel", "system")
      .not("body_text", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const coachFirstName =
    (coach?.first_name as string | null)?.trim() ||
    (coach?.full_name as string | null)?.trim().split(/\s+/)[0] ||
    "the coach";

  return NextResponse.json({
    coach_first_name: coachFirstName,
    prospect_name: conversation.prospect_name?.trim() || null,
    latest_reply: (latest?.body_text as string | null)?.trim() || null,
  });
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error || !auth.userId) {
    return NextResponse.json({ error: auth.error ?? "Not authorized." }, { status: 401 });
  }

  const body = ((await request.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  const id = typeof body.conversation_id === "string" ? body.conversation_id.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!UUID.test(id)) return NextResponse.json({ error: "Which conversation?" }, { status: 400 });
  if (!message) return NextResponse.json({ error: "Write a message first." }, { status: 400 });

  const conversation = await loadConversation(id);
  if (!conversation) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });

  const prospect = conversation.prospect_name?.trim() || "a prospect";
  const { data: chat, error } = await supabaseAdmin
    .from("community_feedback_reports")
    .insert({
      created_by: conversation.coach_id,
      created_by_admin: auth.userId,
      source: "admin_created",
      assigned_to: DEFAULT_SUPPORT_ASSIGNEE_ID,
      type: "question",
      title: `About ${prospect}`,
      details: message,
      status: "waiting_reply",
      member_notify_email: true,
      context_path: conversationChatPath(conversation.id),
    })
    .select("id")
    .single();
  if (error || !chat) {
    console.error("admin coach-chat insert:", error);
    return NextResponse.json({ error: "Could not start the chat." }, { status: 500 });
  }

  const sent = await sendSupportCreatedTicketEmail({
    ticketId: chat.id as string,
    signatureUserId: auth.userId,
    request,
  });

  return NextResponse.json({
    id: chat.id,
    coach_id: conversation.coach_id,
    emailed: sent.ok ? (sent.emailed ?? null) : null,
    email_error: sent.ok ? null : sent.error,
  });
}
