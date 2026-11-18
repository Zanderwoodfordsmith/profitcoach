import { NextResponse, after } from "next/server";

import { phoneMatchKey } from "@/lib/messaging/knownContacts";
import { requireAdmin } from "@/lib/requireAdmin";
import { DEFAULT_SUPPORT_ASSIGNEE_ID } from "@/lib/support/assignees";
import { chatPageFor } from "@/lib/support/chatPages";
import { processDueSupportReplyEmails, queueSupportReplyEmailNotify } from "@/lib/support/notifyCoachOfReply";
import {
  SUPPORT_AUTHOR_SELECT,
  SUPPORT_OPENING_SEEN_SELECT,
  SUPPORT_REPLY_LIST_SELECT,
} from "@/lib/support/tickets";
import { listSupportWhatsAppLines, sendSupportReplyOnWhatsApp, supportWhatsAppRoute } from "@/lib/support/whatsapp";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * BCA writing to a coach from the Support chat on the right, while viewing as
 * that coach (18 Nov, job 228). Messages go as BCA (the admin), not as them.
 * Like a reply in Support, each one can also go by email or on WhatsApp.
 * GET ?coach_id= (&report_id=): can this go on WhatsApp, and from whose phone.
 * POST: start a chat about what's on screen (or reply in one).
 */

const UUID = /^[0-9a-f-]{36}$/i;
type Via = "none" | "email" | "whatsapp";

/** Same columns as the coach's chat list reads, so the panel can show it straight away. */
const THREAD_SELECT = `id, created_at, created_by, created_by_admin, source, ticket_number, type, title, details, page_path, status, media, coach_last_read_at, member_notify_email, topic, context_path, ${SUPPORT_OPENING_SEEN_SELECT}, author:profiles!created_by (${SUPPORT_AUTHOR_SELECT}), opener:profiles!created_by_admin (${SUPPORT_AUTHOR_SELECT})`;

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error || !auth.userId) return NextResponse.json({ error: auth.error }, { status: 401 });
  const params = new URL(request.url).searchParams;
  const reportId = params.get("report_id")?.trim() ?? "";
  const coachId = params.get("coach_id")?.trim() ?? "";

  // A chat that exists: exactly as Support decides.
  if (UUID.test(reportId)) {
    const route = await supportWhatsAppRoute({ reportId, adminId: auth.userId });
    return NextResponse.json(route.ok ? { available: true, from: route.fromName } : { available: false, reason: route.reason });
  }
  if (!UUID.test(coachId)) return NextResponse.json({ error: "Which coach?" }, { status: 400 });

  // No chat yet: the same checks before there is one (their phone, a linked BCA WhatsApp).
  const { data: coach } = await supabaseAdmin.from("profiles").select("phone").eq("id", coachId).maybeSingle();
  const to = phoneMatchKey((coach?.phone as string | null) ?? null);
  if (!to) return NextResponse.json({ available: false, reason: "No phone number on this coach's profile." });
  const lines = (await listSupportWhatsAppLines()).filter((l) => l.status === "OK");
  if (!lines.length) return NextResponse.json({ available: false, reason: "Link your WhatsApp first (Support → Inbox)." });
  if (lines.some((l) => l.phone === to)) return NextResponse.json({ available: false, reason: "That number is one of BCA's own." });
  const line = lines.find((l) => l.admin_id === auth.userId) ?? lines[0]!;
  const { data: owner } = await supabaseAdmin.from("profiles").select("first_name").eq("id", line.admin_id).maybeSingle();
  return NextResponse.json({ available: true, from: (owner?.first_name as string | null)?.trim() || "BCA" });
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error || !auth.userId) {
    return NextResponse.json({ error: auth.error ?? "Not authorized." }, { status: 401 });
  }
  const adminId = auth.userId;

  const input = ((await request.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  const coachId = typeof input.coach_id === "string" ? input.coach_id.trim() : "";
  let reportId = typeof input.report_id === "string" ? input.report_id.trim() : "";
  const text = typeof input.body === "string" ? input.body.trim() : "";
  const media = Array.isArray(input.media) && input.media.length ? input.media : null;
  const via: Via = input.via === "email" || input.via === "whatsapp" ? input.via : "none";
  const about = typeof input.about === "string" && input.about.startsWith("/coach/") ? input.about.trim() : null;
  /** What BCA saw it as: "Lead Magnets", "Jason Dodd". */
  const aboutName = typeof input.about_name === "string" ? input.about_name.trim().slice(0, 80) || null : null;
  if (!UUID.test(coachId)) return NextResponse.json({ error: "Which coach?" }, { status: 400 });
  if (!text && !media) return NextResponse.json({ error: "Write a message first." }, { status: 400 });

  let report: Record<string, unknown> | null = null;
  if (reportId) {
    const { data: existing } = await supabaseAdmin
      .from("community_feedback_reports")
      .select("id, created_by")
      .eq("id", reportId)
      .maybeSingle();
    if (!existing || existing.created_by !== coachId) {
      return NextResponse.json({ error: "Chat not found." }, { status: 404 });
    }
  } else {
    // A new chat about what's on screen. It opens with what it's about; the
    // message is its first reply, so email and WhatsApp work as in Support.
    const linked = about ? (chatPageFor(about) ?? chatPageFor(about.split("?")[0])) : null;
    const name = aboutName ?? linked?.name ?? null;
    const { data: created, error } = await supabaseAdmin
      .from("community_feedback_reports")
      .insert({
        created_by: coachId,
        created_by_admin: adminId,
        source: "admin_created",
        assigned_to: DEFAULT_SUPPORT_ASSIGNEE_ID,
        type: "question",
        title: name ? `About ${name}` : text.split(/\s+/).slice(0, 6).join(" ") || "New chat",
        details: name ? `About ${name}` : "A note from BCA",
        status: "waiting_reply",
        member_notify_email: true,
        page_path: about ? about.split("?")[0] : null,
        // Any coach page: a tab, a prospect, a campaign, so its button opens exactly that.
        context_path: about ?? (linked ? linked.path : null),
      })
      .select(THREAD_SELECT)
      .single();
    if (error || !created) {
      console.error("admin coach-chat insert:", error);
      return NextResponse.json({ error: "Could not start the chat." }, { status: 500 });
    }
    report = created as Record<string, unknown>;
    reportId = report.id as string;
  }

  const { data: reply, error: replyError } = await supabaseAdmin
    .from("community_feedback_replies")
    .insert({ report_id: reportId, created_by: adminId, body: text, media, via_email: via === "email" })
    .select(SUPPORT_REPLY_LIST_SELECT)
    .single();
  if (replyError || !reply) {
    console.error("admin coach-chat reply:", replyError);
    return NextResponse.json({ error: "Could not send. Try again." }, { status: 500 });
  }

  // Also by email or on WhatsApp, as chosen. Email goes once the message shows (it takes a few seconds).
  const replyId = (reply as { id: string }).id;
  const chatId = reportId;
  if (via === "email") {
    after(async () => {
      const queued = await queueSupportReplyEmailNotify(chatId);
      if (queued.ok) await processDueSupportReplyEmails(1, request, chatId);
    });
  }
  let whatsappError: string | null = null;
  if (via === "whatsapp") {
    const sent = await sendSupportReplyOnWhatsApp({ replyId, adminId });
    if (!sent.ok) whatsappError = sent.error;
  }

  return NextResponse.json({ report, reply, whatsapp_error: whatsappError });
}
