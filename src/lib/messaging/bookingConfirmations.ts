import {
  birdSendSms,
  getBirdSenderDefaults,
  isBirdConfigured,
  normalizePhoneE164,
} from "@/lib/bird/client";
import { loadReminderSequence } from "@/lib/booking/bookingService";
import {
  confirmationStep,
  dueReminderSteps,
  interpolateReminderText,
  MAX_REMINDER_LEAD_MINUTES,
  reminderTextToHtml,
  sentReminderStepIds,
  type BookingNotifyVars,
  type BookingReminderStep,
} from "@/lib/booking/reminderSequence";
import { conversationActivityPatch } from "@/lib/messaging/conversationActivity";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getOkMailingAccount } from "@/lib/unipile/outreachAccounts";
import {
  getUnipileEmail,
  isUnipileConfigured,
  sendUnipileEmail,
} from "@/lib/unipile/client";

export type BookingNotifyInput = {
  bookingId: string;
  coachId: string;
  coachName: string;
  coachEmail?: string | null;
  contactId?: string | null;
  calendarId?: string | null;
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

export type BookingNotifyResult = {
  conversationId: string | null;
  emailOk: boolean;
  smsOk: boolean;
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

function emailThreadKey(threadId: string | null | undefined, emailId: string) {
  const tid = (threadId || "").trim();
  if (tid) return `email_thread:${tid}`;
  return `email:${emailId}`;
}

function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

async function ensureConversation(
  input: BookingNotifyInput,
  subject: string,
  unipileAccountId?: string | null
): Promise<string | null> {
  if (input.conversationId) {
    if (unipileAccountId) {
      await supabaseAdmin
        .from("messaging_conversations")
        .update({ unipile_account_id: unipileAccountId })
        .eq("id", input.conversationId)
        .is("unipile_account_id", null);
    }
    return input.conversationId;
  }

  const { data: existing } = await supabaseAdmin
    .from("messaging_conversations")
    .select("id")
    .eq("booking_id", input.bookingId)
    .maybeSingle();
  if (existing?.id) {
    if (unipileAccountId) {
      await supabaseAdmin
        .from("messaging_conversations")
        .update({ unipile_account_id: unipileAccountId })
        .eq("id", existing.id)
        .is("unipile_account_id", null);
    }
    return existing.id as string;
  }

  const { data: conversation, error } = await supabaseAdmin
    .from("messaging_conversations")
    .insert({
      coach_id: input.coachId,
      contact_id: input.contactId || null,
      booking_id: input.bookingId,
      subject,
      prospect_name: input.prospectName,
      prospect_email: normalizeEmail(input.prospectEmail),
      prospect_phone: input.prospectPhone || null,
      last_message_at: new Date().toISOString(),
      last_channel: "email",
      unipile_account_id: unipileAccountId || null,
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
  unipileMessageId?: string | null;
  error?: string | null;
  status: string;
  meta: Record<string, string>;
}) {
  if (args.unipileMessageId) {
    await supabaseAdmin.from("messaging_messages").upsert(
      {
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
        unipile_message_id: args.unipileMessageId,
        provider_error: args.error || null,
        metadata: args.meta,
      },
      { onConflict: "unipile_message_id", ignoreDuplicates: true }
    );
  } else {
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
      unipile_message_id: null,
      provider_error: args.error || null,
      metadata: args.meta,
    });
  }

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
      ...conversationActivityPatch({
        lastChannel: args.channel,
        lastDirection: "outbound",
        lastMessageAt: new Date().toISOString(),
        lastPreview: preview || args.subject || null,
      }),
      unread_count: unread + 1,
      ...(args.subject ? { subject: args.subject } : {}),
    })
    .eq("id", args.conversationId);
}

async function linkConversationToEmailThread(args: {
  conversationId: string;
  accountId: string;
  emailId: string;
}) {
  const full = await getUnipileEmail(args.emailId, args.accountId);
  const threadId =
    typeof full.data?.thread_id === "string" ? full.data.thread_id : null;
  const key = emailThreadKey(threadId, args.emailId);
  await supabaseAdmin
    .from("messaging_conversations")
    .update({
      unipile_chat_id: key,
      unipile_account_id: args.accountId,
    })
    .eq("id", args.conversationId);
}

async function lastUnipileEmailId(
  conversationId: string
): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("messaging_messages")
    .select("unipile_message_id")
    .eq("conversation_id", conversationId)
    .eq("channel", "email")
    .not("unipile_message_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const id = (data?.unipile_message_id as string | null)?.trim();
  return id || null;
}

async function sendBookingEmail(args: {
  input: BookingNotifyInput;
  conversationId: string;
  subject: string;
  text: string;
  html: string;
  meta: Record<string, string>;
  threadReply: boolean;
}): Promise<boolean> {
  const toEmail = normalizeEmail(args.input.prospectEmail);
  if (!toEmail) {
    await appendOutbound({
      conversationId: args.conversationId,
      coachId: args.input.coachId,
      channel: "email",
      subject: args.subject,
      bodyText: args.text,
      bodyHtml: args.html,
      fromAddress: args.input.coachName,
      toAddress: args.input.prospectEmail,
      error: "No recipient email.",
      status: "failed",
      meta: { ...args.meta, via: "unipile" },
    });
    return false;
  }

  if (!isUnipileConfigured()) {
    await appendOutbound({
      conversationId: args.conversationId,
      coachId: args.input.coachId,
      channel: "email",
      subject: args.subject,
      bodyText: args.text,
      bodyHtml: args.html,
      fromAddress: args.input.coachName,
      toAddress: toEmail,
      error: "Unipile is not configured.",
      status: "failed",
      meta: { ...args.meta, via: "unipile" },
    });
    return false;
  }

  let mailbox: Awaited<ReturnType<typeof getOkMailingAccount>> = null;
  try {
    mailbox = await getOkMailingAccount(args.input.coachId);
  } catch (err) {
    console.error("getOkMailingAccount:", err);
  }

  if (!mailbox) {
    const error =
      "Connect Gmail or Outlook to send booking emails from your inbox.";
    console.warn(
      `booking email skipped (${args.meta.kind}) booking=${args.input.bookingId}: ${error}`
    );
    await appendOutbound({
      conversationId: args.conversationId,
      coachId: args.input.coachId,
      channel: "email",
      subject: args.subject,
      bodyText: args.text,
      bodyHtml: args.html,
      fromAddress: args.input.coachName,
      toAddress: toEmail,
      error,
      status: "failed",
      meta: { ...args.meta, via: "unipile", skip: "no_mailbox" },
    });
    return false;
  }

  const replyTo = args.threadReply
    ? await lastUnipileEmailId(args.conversationId)
    : undefined;

  let res = await sendUnipileEmail({
    account_id: mailbox.unipile_account_id,
    to: [
      {
        identifier: toEmail,
        display_name: args.input.prospectName,
      },
    ],
    subject: args.subject,
    body: args.html,
    ...(replyTo ? { reply_to: replyTo } : {}),
  });

  if (!res.ok && replyTo) {
    res = await sendUnipileEmail({
      account_id: mailbox.unipile_account_id,
      to: [
        {
          identifier: toEmail,
          display_name: args.input.prospectName,
        },
      ],
      subject: args.subject,
      body: args.html,
    });
  }

  const emailId = res.data?.tracking_id?.trim() || null;
  await appendOutbound({
    conversationId: args.conversationId,
    coachId: args.input.coachId,
    channel: "email",
    subject: args.subject,
    bodyText: args.text,
    bodyHtml: args.html,
    fromAddress: `${args.input.coachName} <${mailbox.display_name || "mailbox"}>`,
    toAddress: toEmail,
    unipileMessageId: emailId,
    error: res.error || null,
    status: res.ok ? "accepted" : "failed",
    meta: {
      ...args.meta,
      via: "unipile",
      account_id: mailbox.unipile_account_id,
      ...(res.data?.provider_id
        ? { provider_id: String(res.data.provider_id) }
        : {}),
    },
  });

  if (res.ok && emailId) {
    try {
      await linkConversationToEmailThread({
        conversationId: args.conversationId,
        accountId: mailbox.unipile_account_id,
        emailId,
      });
    } catch (err) {
      console.error("linkConversationToEmailThread:", err);
    }
  } else if (!res.ok) {
    console.error(
      `booking email failed (${args.meta.kind}) booking=${args.input.bookingId}:`,
      res.error
    );
  }

  return res.ok;
}

async function sendBookingSms(args: {
  input: BookingNotifyInput;
  conversationId: string;
  text: string;
  meta: Record<string, string>;
}): Promise<boolean> {
  if (!isBirdConfigured()) return false;
  const sender = getBirdSenderDefaults();
  const e164 = normalizePhoneE164(args.input.prospectPhone);
  if (!sender.smsFrom || !e164) return false;

  const smsRes = await birdSendSms({
    to: e164,
    from: sender.smsFrom,
    text: args.text,
    metadata: args.meta,
  });

  await appendOutbound({
    conversationId: args.conversationId,
    coachId: args.input.coachId,
    channel: "sms",
    bodyText: args.text,
    fromAddress: sender.smsFrom,
    toAddress: e164,
    birdId: smsRes.id,
    error: smsRes.error,
    status: smsRes.ok ? smsRes.status || "accepted" : "failed",
    meta: { ...args.meta, via: "bird" },
  });

  return smsRes.ok;
}

function notifyVars(input: BookingNotifyInput): BookingNotifyVars {
  const when = formatWhen(input.startsAtIso, input.timezone || "UTC");
  const where =
    input.meetingJoinUrl ||
    input.locationLabel ||
    "Details will follow closer to the call.";
  return {
    first_name: input.prospectName.split(/\s+/)[0] || "there",
    coach_name: input.coachName,
    calendar_title: input.calendarTitle,
    when,
    where,
  };
}

function asReminderSendsMap(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!key.trim()) continue;
    out[key] = typeof value === "string" ? value : String(value);
  }
  return out;
}

async function markReminderSend(args: {
  bookingId: string;
  stepId: string;
  reminderSentAt?: boolean;
}) {
  const { data } = await supabaseAdmin
    .from("bookings")
    .select("reminder_sends")
    .eq("id", args.bookingId)
    .maybeSingle();
  const next = {
    ...asReminderSendsMap(data?.reminder_sends),
    [args.stepId]: new Date().toISOString(),
  };
  await supabaseAdmin
    .from("bookings")
    .update({
      reminder_sends: next,
      ...(args.reminderSentAt
        ? { reminder_sent_at: new Date().toISOString() }
        : {}),
    })
    .eq("id", args.bookingId);
}

async function sendBookingSequenceStep(args: {
  input: BookingNotifyInput;
  step: BookingReminderStep;
  threadReply: boolean;
}): Promise<BookingNotifyResult> {
  const vars = notifyVars(args.input);
  const subject = interpolateReminderText(args.step.subject, vars);
  const text = interpolateReminderText(args.step.body, vars);
  const html = reminderTextToHtml(text);

  let mailboxId: string | null = null;
  try {
    mailboxId =
      (await getOkMailingAccount(args.input.coachId))?.unipile_account_id ??
      null;
  } catch (err) {
    console.error("getOkMailingAccount:", err);
  }

  const conversationId = await ensureConversation(
    args.input,
    subject,
    mailboxId
  );
  if (!conversationId) {
    return { conversationId: null, emailOk: false, smsOk: false };
  }

  const meta = {
    booking_id: args.input.bookingId,
    conversation_id: conversationId,
    coach_id: args.input.coachId,
    kind: args.step.kind,
    step_id: args.step.id,
  };

  let emailOk = true;
  if (args.step.email) {
    emailOk = await sendBookingEmail({
      input: args.input,
      conversationId,
      subject,
      text,
      html,
      meta,
      threadReply: args.threadReply,
    });
  }

  let smsOk = true;
  if (args.step.sms) {
    smsOk = await sendBookingSms({
      input: args.input,
      conversationId,
      text,
      meta,
    });
  }

  return { conversationId, emailOk, smsOk };
}

export async function sendBookingConfirmations(
  input: BookingNotifyInput
): Promise<BookingNotifyResult> {
  const sequence = await loadReminderSequence(input.coachId, input.calendarId);
  const step = confirmationStep(sequence);
  if (!step.enabled || (!step.email && !step.sms)) {
    return { conversationId: input.conversationId ?? null, emailOk: true, smsOk: true };
  }

  const result = await sendBookingSequenceStep({
    input,
    step,
    threadReply: false,
  });
  try {
    await markReminderSend({
      bookingId: input.bookingId,
      stepId: step.id,
    });
  } catch (err) {
    console.error("markReminderSend confirmation:", err);
  }
  return result;
}

export async function sendBookingReminder(
  input: BookingNotifyInput,
  step?: BookingReminderStep
): Promise<BookingNotifyResult> {
  const resolved =
    step ??
    (await loadReminderSequence(input.coachId, input.calendarId)).find(
      (s) => s.kind === "reminder"
    );
  if (!resolved || resolved.kind !== "reminder") {
    return {
      conversationId: input.conversationId ?? null,
      emailOk: false,
      smsOk: false,
    };
  }
  return sendBookingSequenceStep({
    input,
    step: resolved,
    threadReply: true,
  });
}

export async function processDueBookingReminders(limit = 25): Promise<{
  scanned: number;
  sent: number;
  errors: number;
}> {
  const now = Date.now();
  const windowStart = new Date(now).toISOString();
  const windowEnd = new Date(
    now + MAX_REMINDER_LEAD_MINUTES * 60_000
  ).toISOString();

  const { data: bookings, error } = await supabaseAdmin
    .from("bookings")
    .select(
      "id, coach_id, contact_id, calendar_id, starts_at, ends_at, created_at, reminder_sent_at, reminder_sends, prospect_name, prospect_email, prospect_phone, prospect_timezone, meeting_join_url, meeting_phone, meeting_instructions, meeting_location_type"
    )
    .eq("status", "booked")
    .gt("starts_at", windowStart)
    .lte("starts_at", windowEnd)
    .order("starts_at", { ascending: true })
    .limit(300);

  if (error) {
    console.error("processDueBookingReminders:", error);
    return { scanned: 0, sent: 0, errors: 1 };
  }

  const rows = bookings ?? [];
  const sequenceByKey = new Map<string, BookingReminderStep[]>();
  let sent = 0;
  let errors = 0;
  let dispatched = 0;

  for (const b of rows) {
    if (dispatched >= limit) break;
    try {
      if (!b.prospect_email) {
        errors += 1;
        continue;
      }

      const coachId = b.coach_id as string;
      const calendarId = (b.calendar_id as string | null) ?? null;
      const sequenceKey = calendarId ?? `coach:${coachId}`;
      if (!sequenceByKey.has(sequenceKey)) {
        sequenceByKey.set(
          sequenceKey,
          await loadReminderSequence(coachId, calendarId)
        );
      }
      const sequence = sequenceByKey.get(sequenceKey)!;
      const sentIds = sentReminderStepIds({
        reminderSends: b.reminder_sends,
        reminderSentAt: (b.reminder_sent_at as string | null) ?? null,
        sequence,
      });
      const due = dueReminderSteps({
        sequence,
        startsAtMs: new Date(b.starts_at as string).getTime(),
        createdAtMs: new Date(
          (b.created_at as string | null) || (b.starts_at as string)
        ).getTime(),
        nowMs: now,
        sentStepIds: sentIds,
      });
      if (due.length === 0) continue;

      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("full_name, coach_business_name")
        .eq("id", coachId)
        .maybeSingle();
      const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(
        coachId
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

      const input: BookingNotifyInput = {
        bookingId: b.id as string,
        coachId,
        coachName,
        coachEmail: authUser.user?.email ?? null,
        contactId: (b.contact_id as string | null) ?? null,
        calendarId,
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
      };

      for (const step of due) {
        if (dispatched >= limit) break;
        dispatched += 1;
        const result = await sendBookingSequenceStep({
          input,
          step,
          threadReply: true,
        });
        await markReminderSend({
          bookingId: input.bookingId,
          stepId: step.id,
          reminderSentAt: true,
        });
        if (result.emailOk || result.smsOk) sent += 1;
        else errors += 1;
      }
    } catch (err) {
      console.error("reminder for booking", b.id, err);
      errors += 1;
    }
  }

  return { scanned: rows.length, sent, errors };
}
