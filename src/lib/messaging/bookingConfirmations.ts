import {
  birdSendEmail,
  birdSendSms,
  conversationReplyToAddress,
  getBirdSenderDefaults,
  isBirdConfigured,
  normalizePhoneE164,
} from "@/lib/bird/client";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type BookingNotifyInput = {
  bookingId: string;
  coachId: string;
  coachName: string;
  coachEmail?: string | null;
  contactId?: string | null;
  calendarTitle: string;
  prospectName: string;
  prospectEmail: string;
  prospectPhone?: string | null;
  startsAtIso: string;
  endsAtIso: string;
  timezone: string;
  locationLabel?: string | null;
  meetingJoinUrl?: string | null;
  /** Existing thread to append to; created if missing. */
  conversationId?: string | null;
};

function formatWhen(iso: string, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone,
      timeZoneName: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/'/g, "&#39;");
}

async function ensureConversation(
  input: BookingNotifyInput,
  subject: string
): Promise<string | null> {
  if (input.conversationId) return input.conversationId;

  const { data: existing } = await supabaseAdmin
    .from("messaging_conversations")
    .select("id")
    .eq("booking_id", input.bookingId)
    .maybeSingle();
  if (existing?.id) return existing.id as string;

  const { data: conversation, error } = await supabaseAdmin
    .from("messaging_conversations")
    .insert({
      coach_id: input.coachId,
      contact_id: input.contactId || null,
      booking_id: input.bookingId,
      subject,
      prospect_name: input.prospectName,
      prospect_email: input.prospectEmail,
      prospect_phone: input.prospectPhone || null,
      last_message_at: new Date().toISOString(),
    })
    .select("id")
    .maybeSingle();

  if (error || !conversation?.id) {
    console.error("messaging_conversations insert:", error);
    return null;
  }
  return conversation.id as string;
}

async function appendOutbound(args: {
  conversationId: string;
  coachId: string;
  channel: "email" | "sms";
  subject?: string | null;
  bodyText: string;
  bodyHtml?: string | null;
  fromAddress: string;
  toAddress: string;
  birdId?: string | null;
  error?: string | null;
  status: string;
  meta: Record<string, string>;
  raw?: unknown;
}) {
  await supabaseAdmin.from("messaging_messages").insert({
    conversation_id: args.conversationId,
    coach_id: args.coachId,
    channel: args.channel,
    direction: "outbound",
    status: args.status,
    subject: args.subject || null,
    body_text: args.bodyText,
    body_html: args.bodyHtml || null,
    from_address: args.fromAddress,
    to_address: args.toAddress,
    bird_message_id: args.birdId || null,
    provider_error: args.error || null,
    metadata: { ...(args.raw as object), meta: args.meta },
  });

  const preview = args.bodyText.replace(/\s+/g, " ").trim().slice(0, 160);
  const { data: conv } = await supabaseAdmin
    .from("messaging_conversations")
    .select("unread_count")
    .eq("id", args.conversationId)
    .maybeSingle();
  const unread = typeof conv?.unread_count === "number" ? conv.unread_count : 0;

  await supabaseAdmin
    .from("messaging_conversations")
    .update({
      last_message_at: new Date().toISOString(),
      last_preview: preview || args.subject || null,
      last_channel: args.channel,
      // Surface new activity in Unread until the coach opens the thread.
      unread_count: unread + 1,
      ...(args.subject ? { subject: args.subject } : {}),
    })
    .eq("id", args.conversationId);
}

export async function sendBookingConfirmations(
  input: BookingNotifyInput
): Promise<{ conversationId: string | null; emailOk: boolean; smsOk: boolean }> {
  if (!isBirdConfigured()) {
    console.warn("Bird not configured — skipping booking confirmations.");
    return { conversationId: null, emailOk: false, smsOk: false };
  }

  const when = formatWhen(input.startsAtIso, input.timezone || "UTC");
  const subject = `Confirmed: ${input.calendarTitle} with ${input.coachName}`;
  const locationLine =
    input.meetingJoinUrl ||
    input.locationLabel ||
    "Details will follow closer to the call.";
  const first = input.prospectName.split(/\s+/)[0] || "there";

  const text = [
    `Hi ${first},`,
    "",
    `Your ${input.calendarTitle} with ${input.coachName} is booked.`,
    "",
    `When: ${when}`,
    `Where: ${locationLine}`,
    "",
    "Reply to this email if you need to reschedule.",
    "",
    `— ${input.coachName}`,
  ].join("\n");

  const html = `
    <p>Hi ${escapeHtml(first)},</p>
    <p>Your <strong>${escapeHtml(input.calendarTitle)}</strong> with
    <strong>${escapeHtml(input.coachName)}</strong> is booked.</p>
    <p><strong>When:</strong> ${escapeHtml(when)}<br/>
    <strong>Where:</strong> ${
      input.meetingJoinUrl
        ? `<a href="${escapeAttr(input.meetingJoinUrl)}">${escapeHtml(input.meetingJoinUrl)}</a>`
        : escapeHtml(locationLine)
    }</p>
    <p>Reply to this email if you need to reschedule.</p>
    <p>— ${escapeHtml(input.coachName)}</p>
  `.trim();

  const conversationId = await ensureConversation(input, subject);
  if (!conversationId) {
    return { conversationId: null, emailOk: false, smsOk: false };
  }

  const sender = getBirdSenderDefaults();
  const meta = {
    booking_id: input.bookingId,
    conversation_id: conversationId,
    coach_id: input.coachId,
    kind: "confirmation",
  };

  const emailRes = await birdSendEmail({
    toEmail: input.prospectEmail,
    toName: input.prospectName,
    fromEmail: sender.fromEmail,
    fromName: input.coachName || sender.fromName,
    // Route replies into Bird on send.* so Conversations can ingest them.
    replyTo: conversationReplyToAddress(conversationId),
    subject,
    text,
    html,
    metadata: meta,
  });

  await appendOutbound({
    conversationId,
    coachId: input.coachId,
    channel: "email",
    subject,
    bodyText: text,
    bodyHtml: html,
    fromAddress: `${input.coachName} <${sender.fromEmail}>`,
    toAddress: input.prospectEmail,
    birdId: emailRes.id,
    error: emailRes.error,
    status: emailRes.ok ? emailRes.status || "accepted" : "failed",
    meta,
    raw: emailRes.raw,
  });

  let smsOk = false;
  const e164 = normalizePhoneE164(input.prospectPhone);
  if (sender.smsFrom && e164) {
    const smsText =
      `Confirmed: ${input.calendarTitle} with ${input.coachName} on ${when}. ` +
      `${input.meetingJoinUrl ? `Join: ${input.meetingJoinUrl}` : ""}`.trim();

    const smsRes = await birdSendSms({
      to: e164,
      from: sender.smsFrom,
      text: smsText,
      metadata: meta,
    });
    smsOk = smsRes.ok;

    await appendOutbound({
      conversationId,
      coachId: input.coachId,
      channel: "sms",
      bodyText: smsText,
      fromAddress: sender.smsFrom,
      toAddress: e164,
      birdId: smsRes.id,
      error: smsRes.error,
      status: smsRes.ok ? smsRes.status || "accepted" : "failed",
      meta,
      raw: smsRes.raw,
    });
  }

  return { conversationId, emailOk: emailRes.ok, smsOk };
}

export async function sendBookingReminder(
  input: BookingNotifyInput
): Promise<{ conversationId: string | null; emailOk: boolean; smsOk: boolean }> {
  if (!isBirdConfigured()) {
    return { conversationId: null, emailOk: false, smsOk: false };
  }

  const when = formatWhen(input.startsAtIso, input.timezone || "UTC");
  const subject = `Reminder: ${input.calendarTitle} with ${input.coachName} in 2 hours`;
  const locationLine =
    input.meetingJoinUrl ||
    input.locationLabel ||
    "Check your confirmation email for details.";
  const first = input.prospectName.split(/\s+/)[0] || "there";

  const text = [
    `Hi ${first},`,
    "",
    `Quick reminder — your ${input.calendarTitle} with ${input.coachName} starts in about 2 hours.`,
    "",
    `When: ${when}`,
    `Where: ${locationLine}`,
    "",
    `— ${input.coachName}`,
  ].join("\n");

  const html = `
    <p>Hi ${escapeHtml(first)},</p>
    <p>Quick reminder — your <strong>${escapeHtml(input.calendarTitle)}</strong> with
    <strong>${escapeHtml(input.coachName)}</strong> starts in about 2 hours.</p>
    <p><strong>When:</strong> ${escapeHtml(when)}<br/>
    <strong>Where:</strong> ${
      input.meetingJoinUrl
        ? `<a href="${escapeAttr(input.meetingJoinUrl)}">${escapeHtml(input.meetingJoinUrl)}</a>`
        : escapeHtml(locationLine)
    }</p>
    <p>— ${escapeHtml(input.coachName)}</p>
  `.trim();

  const conversationId = await ensureConversation(input, subject);
  if (!conversationId) {
    return { conversationId: null, emailOk: false, smsOk: false };
  }

  const sender = getBirdSenderDefaults();
  const meta = {
    booking_id: input.bookingId,
    conversation_id: conversationId,
    coach_id: input.coachId,
    kind: "reminder",
  };

  const emailRes = await birdSendEmail({
    toEmail: input.prospectEmail,
    toName: input.prospectName,
    fromEmail: sender.fromEmail,
    fromName: input.coachName || sender.fromName,
    // Route replies into Bird on send.* so Conversations can ingest them.
    replyTo: conversationReplyToAddress(conversationId),
    subject,
    text,
    html,
    metadata: meta,
  });

  await appendOutbound({
    conversationId,
    coachId: input.coachId,
    channel: "email",
    subject,
    bodyText: text,
    bodyHtml: html,
    fromAddress: `${input.coachName} <${sender.fromEmail}>`,
    toAddress: input.prospectEmail,
    birdId: emailRes.id,
    error: emailRes.error,
    status: emailRes.ok ? emailRes.status || "accepted" : "failed",
    meta,
    raw: emailRes.raw,
  });

  let smsOk = false;
  const e164 = normalizePhoneE164(input.prospectPhone);
  if (sender.smsFrom && e164) {
    const smsText =
      `Reminder: ${input.calendarTitle} with ${input.coachName} in ~2 hours (${when}). ` +
      `${input.meetingJoinUrl ? `Join: ${input.meetingJoinUrl}` : ""}`.trim();
    const smsRes = await birdSendSms({
      to: e164,
      from: sender.smsFrom,
      text: smsText,
      metadata: meta,
    });
    smsOk = smsRes.ok;
    await appendOutbound({
      conversationId,
      coachId: input.coachId,
      channel: "sms",
      bodyText: smsText,
      fromAddress: sender.smsFrom,
      toAddress: e164,
      birdId: smsRes.id,
      error: smsRes.error,
      status: smsRes.ok ? smsRes.status || "accepted" : "failed",
      meta,
      raw: smsRes.raw,
    });
  }

  return { conversationId, emailOk: emailRes.ok, smsOk };
}

/** Minutes before starts_at to send the reminder (default 120). */
export function bookingReminderLeadMinutes(): number {
  const raw = process.env.BOOKING_REMINDER_MINUTES_BEFORE?.trim();
  const n = raw ? Number(raw) : 120;
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 120;
}

export async function processDueBookingReminders(limit = 25): Promise<{
  scanned: number;
  sent: number;
  errors: number;
}> {
  if (!isBirdConfigured()) {
    return { scanned: 0, sent: 0, errors: 0 };
  }

  const leadMin = bookingReminderLeadMinutes();
  const now = Date.now();
  const windowStart = new Date(now).toISOString();
  // Reminder is due when starts_at is between now and now+leadMin
  // i.e. we're inside the lead window before the call.
  const windowEnd = new Date(now + leadMin * 60_000).toISOString();

  const { data: bookings, error } = await supabaseAdmin
    .from("bookings")
    .select(
      "id, coach_id, contact_id, calendar_id, starts_at, ends_at, prospect_name, prospect_email, prospect_phone, prospect_timezone, meeting_join_url, meeting_phone, meeting_instructions, meeting_location_type"
    )
    .eq("status", "booked")
    .is("reminder_sent_at", null)
    .gt("starts_at", windowStart)
    .lte("starts_at", windowEnd)
    .order("starts_at", { ascending: true })
    .limit(limit);

  if (error) {
    console.error("processDueBookingReminders:", error);
    return { scanned: 0, sent: 0, errors: 1 };
  }

  const rows = bookings ?? [];
  let sent = 0;
  let errors = 0;

  for (const b of rows) {
    try {
      if (!b.prospect_email) {
        errors += 1;
        continue;
      }

      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("full_name, coach_business_name")
        .eq("id", b.coach_id)
        .maybeSingle();
      const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(
        b.coach_id as string
      );
      const { data: calendar } = b.calendar_id
        ? await supabaseAdmin
            .from("coach_calendars")
            .select("name")
            .eq("id", b.calendar_id)
            .maybeSingle()
        : { data: null };

      const coachName =
        (profile?.full_name as string | null)?.trim() ||
        (profile?.coach_business_name as string | null)?.trim() ||
        "Your coach";

      let locationLabel = "Details in your confirmation email";
      if (b.meeting_join_url) locationLabel = "Video call";
      else if (b.meeting_phone) locationLabel = `Phone · ${b.meeting_phone}`;
      else if (b.meeting_instructions) locationLabel = b.meeting_instructions;

      const { data: conv } = await supabaseAdmin
        .from("messaging_conversations")
        .select("id")
        .eq("booking_id", b.id)
        .maybeSingle();

      const result = await sendBookingReminder({
        bookingId: b.id as string,
        coachId: b.coach_id as string,
        coachName,
        coachEmail: authUser.user?.email ?? null,
        contactId: (b.contact_id as string | null) ?? null,
        calendarTitle:
          (calendar?.name as string | null)?.trim() || "Discovery call",
        prospectName: (b.prospect_name as string) || "there",
        prospectEmail: b.prospect_email as string,
        prospectPhone: (b.prospect_phone as string | null) ?? null,
        startsAtIso: b.starts_at as string,
        endsAtIso: b.ends_at as string,
        timezone: (b.prospect_timezone as string) || "UTC",
        locationLabel,
        meetingJoinUrl: (b.meeting_join_url as string | null) ?? null,
        conversationId: (conv?.id as string | null) ?? null,
      });

      // Mark sent even if one channel failed, so we don't spam retries every minute.
      await supabaseAdmin
        .from("bookings")
        .update({ reminder_sent_at: new Date().toISOString() })
        .eq("id", b.id);

      if (result.emailOk || result.smsOk) sent += 1;
      else errors += 1;
    } catch (err) {
      console.error("reminder for booking", b.id, err);
      errors += 1;
    }
  }

  return { scanned: rows.length, sent, errors };
}
