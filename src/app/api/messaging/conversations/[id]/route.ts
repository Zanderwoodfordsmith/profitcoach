import { NextResponse } from "next/server";
import {
  birdSendEmail,
  birdSendSms,
  conversationReplyToAddress,
  getBirdSenderDefaults,
  isBirdConfigured,
  normalizePhoneE164,
} from "@/lib/bird/client";
import { loadEnrichedProspectById } from "@/lib/prospects/loadEnrichedProspect";
import { loadProspectActivity } from "@/lib/messaging/loadProspectActivity";
import { requireAdmin } from "@/lib/requireAdmin";
import { requireCoachRequest } from "@/lib/requireCoachRequest";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

async function resolveAccess(request: Request): Promise<
  | { error: string; status: number; coachId: null; isAdmin: false }
  | { error: null; coachId: string | null; isAdmin: boolean; userId: string }
> {
  const admin = await requireAdmin(request);
  if (admin.error === null && admin.userId) {
    return {
      error: null,
      coachId: null,
      isAdmin: true,
      userId: admin.userId,
    };
  }
  const coach = await requireCoachRequest(request);
  if (coach.error || !coach.userId) {
    return {
      error: coach.error || admin.error || "Not authorized.",
      status: 401,
      coachId: null,
      isAdmin: false,
    };
  }
  return {
    error: null,
    coachId: coach.userId,
    isAdmin: false,
    userId: coach.userId,
  };
}

async function loadConversation(id: string, coachId: string | null) {
  let q = supabaseAdmin
    .from("messaging_conversations")
    .select(
      "id, coach_id, contact_id, booking_id, subject, prospect_name, prospect_email, prospect_phone, last_message_at, starred, unread_count, last_preview, last_channel"
    )
    .eq("id", id);
  if (coachId) q = q.eq("coach_id", coachId);
  return q.maybeSingle();
}

/**
 * GET /api/messaging/conversations/[id]
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const access = await resolveAccess(request);
  if (access.error) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const { data: conversation, error: convErr } = await loadConversation(
    id,
    access.coachId
  );
  if (convErr || !conversation) {
    return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  }

  // Opening the thread marks it read.
  if ((conversation.unread_count as number) > 0) {
    await supabaseAdmin
      .from("messaging_conversations")
      .update({ unread_count: 0 })
      .eq("id", id);
    conversation.unread_count = 0;
  }

  const { data: messages, error: msgErr } = await supabaseAdmin
    .from("messaging_messages")
    .select(
      "id, channel, direction, status, subject, body_text, body_html, from_address, to_address, bird_message_id, provider_error, created_at"
    )
    .eq("conversation_id", id)
    .order("created_at", { ascending: true });

  if (msgErr) {
    console.error("messaging messages list:", msgErr);
    return NextResponse.json({ error: "Could not load messages." }, { status: 500 });
  }

  // Prefer explicit contact_id; otherwise resolve via booking or email and backfill.
  let contactId = (conversation.contact_id as string | null) ?? null;
  const coachIdForContact =
    (access.coachId as string | null) ||
    ((conversation.coach_id as string | null) ?? null);

  if (!contactId && conversation.booking_id) {
    const { data: bookingContact } = await supabaseAdmin
      .from("bookings")
      .select("contact_id")
      .eq("id", conversation.booking_id as string)
      .maybeSingle();
    const fromBooking = (bookingContact?.contact_id as string | null) ?? null;
    if (fromBooking) contactId = fromBooking;
  }

  if (!contactId && conversation.prospect_email && coachIdForContact) {
    const email = String(conversation.prospect_email).trim();
    if (email) {
      const { data: byEmail } = await supabaseAdmin
        .from("contacts")
        .select("id")
        .eq("coach_id", coachIdForContact)
        .eq("type", "prospect")
        .ilike("email", email)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (byEmail?.id) contactId = byEmail.id as string;
    }
  }

  if (
    contactId &&
    contactId !== (conversation.contact_id as string | null)
  ) {
    await supabaseAdmin
      .from("messaging_conversations")
      .update({ contact_id: contactId })
      .eq("id", id);
    conversation.contact_id = contactId;
  }

  let prospect = null;
  let activity: Awaited<ReturnType<typeof loadProspectActivity>> = [];
  if (contactId) {
    const loaded = await loadEnrichedProspectById(
      contactId,
      access.coachId ? { coachId: access.coachId } : undefined
    );
    prospect = loaded?.prospect ?? null;
    activity = await loadProspectActivity(contactId, {
      coachId: access.coachId ?? coachIdForContact,
    });
  }

  let booking: {
    id: string;
    starts_at: string;
    ends_at: string | null;
    status: string | null;
    prospect_timezone: string | null;
    meeting_join_url: string | null;
    meeting_location_type: string | null;
  } | null = null;
  const bookingId = conversation.booking_id as string | null;
  if (bookingId) {
    const { data: bookingRow } = await supabaseAdmin
      .from("bookings")
      .select(
        "id, starts_at, ends_at, status, prospect_timezone, meeting_join_url, meeting_location_type"
      )
      .eq("id", bookingId)
      .maybeSingle();
    if (bookingRow) booking = bookingRow;
  }

  return NextResponse.json({
    conversation,
    messages: messages ?? [],
    prospect,
    booking,
    activity,
  });
}

/**
 * PATCH /api/messaging/conversations/[id]
 * Body: { starred?: boolean, unread_count?: number }
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const access = await resolveAccess(request);
  if (access.error) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const { data: conversation } = await loadConversation(id, access.coachId);
  if (!conversation) {
    return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    starred?: boolean;
    unread_count?: number;
  };
  const patch: Record<string, unknown> = {};
  if (typeof body.starred === "boolean") patch.starred = body.starred;
  if (typeof body.unread_count === "number" && body.unread_count >= 0) {
    patch.unread_count = Math.floor(body.unread_count);
  }
  if (!Object.keys(patch).length) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const { data: updated, error } = await supabaseAdmin
    .from("messaging_conversations")
    .update(patch)
    .eq("id", id)
    .select(
      "id, coach_id, contact_id, booking_id, subject, prospect_name, prospect_email, prospect_phone, last_message_at, starred, unread_count, last_preview, last_channel"
    )
    .maybeSingle();

  if (error || !updated) {
    console.error("messaging conversation patch:", error);
    return NextResponse.json({ error: "Could not update conversation." }, { status: 500 });
  }

  return NextResponse.json({ conversation: updated });
}

/**
 * POST /api/messaging/conversations/[id]
 * Send a reply: { channel: 'email'|'sms'|'comment', body, subject?, fromName? }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const access = await resolveAccess(request);
  if (access.error) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const { data: conversation } = await loadConversation(id, access.coachId);
  if (!conversation) {
    return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    channel?: string;
    body?: string;
    subject?: string;
    fromName?: string;
  };

  const channel = (body.channel || "email").trim().toLowerCase();
  const text = (body.body || "").trim();
  if (!text) {
    return NextResponse.json({ error: "Message body is required." }, { status: 400 });
  }
  if (!["email", "sms", "comment"].includes(channel)) {
    return NextResponse.json(
      { error: "Channel must be email, sms, or comment." },
      { status: 400 }
    );
  }

  const coachId = conversation.coach_id as string;
  const sender = getBirdSenderDefaults();
  const preview = text.replace(/\s+/g, " ").trim().slice(0, 160);
  const now = new Date().toISOString();

  if (channel === "comment") {
    const { data: msg, error } = await supabaseAdmin
      .from("messaging_messages")
      .insert({
        conversation_id: id,
        coach_id: coachId,
        channel: "system",
        direction: "outbound",
        status: "stored",
        subject: null,
        body_text: text,
        from_address: "internal",
        to_address: "internal",
        metadata: { kind: "internal_comment" },
      })
      .select(
        "id, channel, direction, status, subject, body_text, body_html, from_address, to_address, bird_message_id, provider_error, created_at"
      )
      .maybeSingle();

    if (error || !msg) {
      console.error("internal comment insert:", error);
      return NextResponse.json({ error: "Could not save comment." }, { status: 500 });
    }

    await supabaseAdmin
      .from("messaging_conversations")
      .update({
        last_message_at: now,
        last_preview: preview,
        last_channel: "system",
      })
      .eq("id", id);

    return NextResponse.json({ ok: true, message: msg });
  }

  if (!isBirdConfigured()) {
    return NextResponse.json(
      { error: "Messaging is not configured (Bird)." },
      { status: 503 }
    );
  }

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("full_name, coach_business_name")
    .eq("id", coachId)
    .maybeSingle();

  const fromName =
    body.fromName?.trim() ||
    (profile?.full_name as string | null)?.trim() ||
    (profile?.coach_business_name as string | null)?.trim() ||
    sender.fromName;

  if (channel === "email") {
    const toEmail = (conversation.prospect_email as string | null)?.trim();
    if (!toEmail) {
      return NextResponse.json(
        { error: "This contact has no email address." },
        { status: 400 }
      );
    }
    const subject =
      body.subject?.trim() ||
      (conversation.subject as string | null)?.trim() ||
      "Follow-up";

    const emailRes = await birdSendEmail({
      toEmail,
      toName: (conversation.prospect_name as string | null) || null,
      fromEmail: sender.fromEmail,
      fromName,
      replyTo: conversationReplyToAddress(id),
      subject,
      text,
      metadata: {
        conversation_id: id,
        coach_id: coachId,
        kind: "reply",
      },
    });

    const { data: msg, error } = await supabaseAdmin
      .from("messaging_messages")
      .insert({
        conversation_id: id,
        coach_id: coachId,
        channel: "email",
        direction: "outbound",
        status: emailRes.ok ? emailRes.status || "accepted" : "failed",
        subject,
        body_text: text,
        from_address: `${fromName} <${sender.fromEmail}>`,
        to_address: toEmail,
        bird_message_id: emailRes.id || null,
        provider_error: emailRes.error || null,
        metadata: { kind: "reply", raw: emailRes.raw },
      })
      .select(
        "id, channel, direction, status, subject, body_text, body_html, from_address, to_address, bird_message_id, provider_error, created_at"
      )
      .maybeSingle();

    if (error || !msg) {
      console.error("reply email insert:", error);
      return NextResponse.json(
        { error: emailRes.error || "Could not save email." },
        { status: 500 }
      );
    }

    await supabaseAdmin
      .from("messaging_conversations")
      .update({
        last_message_at: now,
        last_preview: preview,
        last_channel: "email",
        subject,
      })
      .eq("id", id);

    if (!emailRes.ok) {
      return NextResponse.json(
        { error: emailRes.error || "Email send failed.", message: msg },
        { status: 502 }
      );
    }

    return NextResponse.json({ ok: true, message: msg });
  }

  // SMS
  const phone = normalizePhoneE164(
    (conversation.prospect_phone as string | null) || ""
  );
  if (!sender.smsFrom) {
    return NextResponse.json(
      { error: "SMS sender number is not configured." },
      { status: 503 }
    );
  }
  if (!phone) {
    return NextResponse.json(
      { error: "This contact has no phone number." },
      { status: 400 }
    );
  }

  const smsRes = await birdSendSms({
    to: phone,
    from: sender.smsFrom,
    text,
    metadata: {
      conversation_id: id,
      coach_id: coachId,
      kind: "reply",
    },
  });

  const { data: msg, error } = await supabaseAdmin
    .from("messaging_messages")
    .insert({
      conversation_id: id,
      coach_id: coachId,
      channel: "sms",
      direction: "outbound",
      status: smsRes.ok ? smsRes.status || "accepted" : "failed",
      subject: null,
      body_text: text,
      from_address: sender.smsFrom,
      to_address: phone,
      bird_message_id: smsRes.id || null,
      provider_error: smsRes.error || null,
      metadata: { kind: "reply", raw: smsRes.raw },
    })
    .select(
      "id, channel, direction, status, subject, body_text, body_html, from_address, to_address, bird_message_id, provider_error, created_at"
    )
    .maybeSingle();

  if (error || !msg) {
    console.error("reply sms insert:", error);
    return NextResponse.json(
      { error: smsRes.error || "Could not save SMS." },
      { status: 500 }
    );
  }

  await supabaseAdmin
    .from("messaging_conversations")
    .update({
      last_message_at: now,
      last_preview: preview,
      last_channel: "sms",
    })
    .eq("id", id);

  if (!smsRes.ok) {
    return NextResponse.json(
      { error: smsRes.error || "SMS send failed.", message: msg },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true, message: msg });
}
