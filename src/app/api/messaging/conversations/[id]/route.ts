import { NextResponse } from "next/server";
import {
  birdSendSms,
  getBirdSenderDefaults,
  isBirdConfigured,
  normalizePhoneE164,
} from "@/lib/bird/client";
import { enrichMessagingConversationPeople } from "@/lib/messaging/enrichConversationPeople";
import { conversationActivityPatch } from "@/lib/messaging/conversationActivity";
import { resolveConversationLinkedInUrl } from "@/lib/messaging/conversationLinkedInUrl";
import {
  filesFromFormData,
  MAX_MESSAGING_ATTACHMENTS,
  parseMessagingAttachments,
  signMessagingAttachments,
  uploadMessagingAttachment,
  validateMessagingAttachment,
  type MessagingAttachmentMeta,
} from "@/lib/messaging/messageAttachments";
import { scheduleMessagingReply } from "@/lib/messaging/scheduledMessages";
import { loadEnrichedProspectById } from "@/lib/prospects/loadEnrichedProspect";
import { listCoachProspectTags } from "@/lib/prospects/tags";
import { updateProspectFields } from "@/lib/prospects/updateProspectFields";
import { loadProspectActivity } from "@/lib/messaging/loadProspectActivity";
import { loadThreadMessagePage } from "@/lib/messaging/loadThreadMessages";
import {
  clampThreadMessageLimit,
  parseBeforeCursor,
} from "@/lib/messaging/threadWindow";
import { requireAdmin } from "@/lib/requireAdmin";
import { requireCoachRequest } from "@/lib/requireCoachRequest";
import { listOutreachAccounts } from "@/lib/unipile/outreachAccounts";
import { isMailingProvider, providerLabel } from "@/lib/unipile/providers";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

async function resolveAccess(request: Request): Promise<
  | { error: string; status: number; coachId: null; isAdmin: false }
  | { error: null; coachId: string | null; isAdmin: boolean; userId: string }
> {
  const admin = await requireAdmin(request);
  if (admin.error === null && admin.userId) {
    const impersonateId = request.headers
      .get("x-impersonate-coach-id")
      ?.trim();
    return {
      error: null,
      coachId: impersonateId || null,
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
      "id, coach_id, contact_id, booking_id, subject, prospect_name, prospect_email, prospect_phone, prospect_avatar_url, prospect_linkedin_url, prospect_business_name, last_message_at, starred, unread_count, last_preview, last_channel, unipile_chat_id, hidden_at"
    )
    .eq("id", id);
  if (coachId) q = q.eq("coach_id", coachId);
  return q.maybeSingle();
}

async function signThreadMessages(
  messages: Record<string, unknown>[]
): Promise<
  Array<Record<string, unknown> & { attachments: MessagingAttachmentMeta[] }>
> {
  return Promise.all(
    messages.map(async (m) => {
      const meta = (m.metadata as Record<string, unknown> | null) || {};
      const attachments = parseMessagingAttachments(meta.attachments);
      if (!attachments.length) {
        return { ...m, attachments: [] as MessagingAttachmentMeta[] };
      }
      const signed = await signMessagingAttachments(attachments);
      return {
        ...m,
        metadata: { ...meta, attachments: signed },
        attachments: signed,
      };
    })
  );
}

function noStoreJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

/**
 * GET /api/messaging/conversations/[id]
 * Default: newest message page (not full history).
 * ?before=ISO — older page (cursor).
 * ?part=side — prospect / activity / booking (does not block the thread).
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
  if (convErr || !conversation || conversation.hidden_at) {
    return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  }

  const url = new URL(request.url);
  const part = (url.searchParams.get("part") || "").trim().toLowerCase();
  const beforeRaw = url.searchParams.get("before");
  const before = parseBeforeCursor(beforeRaw);
  if (beforeRaw && beforeRaw.trim() && !before) {
    return NextResponse.json({ error: "Invalid before cursor." }, { status: 400 });
  }
  const limit = clampThreadMessageLimit(url.searchParams.get("limit"));

  const isSide = part === "side";
  const isOlderPage = Boolean(before);

  // Opening the thread marks it read. Older pages and the side panel do not.
  if (!isSide && !isOlderPage && (conversation.unread_count as number) > 0) {
    await supabaseAdmin
      .from("messaging_conversations")
      .update({ unread_count: 0 })
      .eq("id", id);
    conversation.unread_count = 0;
  }

  if (!isSide) {
    const page = await loadThreadMessagePage({
      conversationId: id,
      limit,
      before,
    });
    if (page.error) {
      console.error("messaging messages list:", page.error);
      return NextResponse.json({ error: "Could not load messages." }, { status: 500 });
    }
    const enrichedMessages = await signThreadMessages(page.messages);
    if (isOlderPage) {
      return noStoreJson({
        messages: enrichedMessages,
        has_older: page.hasOlder,
      });
    }

    const [enrichedConversation] = await enrichMessagingConversationPeople([
      conversation,
    ]);
    const linkedInUrl = await resolveConversationLinkedInUrl({
      conversationId: id,
      contactId: (conversation.contact_id as string | null) ?? null,
      unipileChatId: (conversation.unipile_chat_id as string | null) ?? null,
      existing:
        (enrichedConversation?.prospect_linkedin_url as string | null) ??
        (conversation.prospect_linkedin_url as string | null) ??
        null,
      fetchAttendees: false,
    });
    if (enrichedConversation && linkedInUrl) {
      enrichedConversation.prospect_linkedin_url = linkedInUrl;
    }

    return noStoreJson({
      conversation: enrichedConversation ?? conversation,
      messages: enrichedMessages,
      has_older: page.hasOlder,
    });
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

  const [enrichedConversation] = await enrichMessagingConversationPeople([
    conversation,
  ]);
  const linkedInUrl = await resolveConversationLinkedInUrl({
    conversationId: id,
    contactId,
    unipileChatId: (conversation.unipile_chat_id as string | null) ?? null,
    existing:
      (enrichedConversation?.prospect_linkedin_url as string | null) ??
      (conversation.prospect_linkedin_url as string | null) ??
      ((prospect as { linkedin_url?: string | null } | null)?.linkedin_url ??
        null),
    fetchAttendees:
      String(conversation.last_channel || "").toLowerCase() === "linkedin",
  });
  if (enrichedConversation && linkedInUrl) {
    enrichedConversation.prospect_linkedin_url = linkedInUrl;
  }

  const coachTags = coachIdForContact
    ? await listCoachProspectTags(coachIdForContact)
    : [];

  return noStoreJson({
    conversation: enrichedConversation ?? conversation,
    prospect,
    booking,
    activity,
    coachTags,
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
    business_name?: string | null;
  };
  const patch: Record<string, unknown> = {};
  if (typeof body.starred === "boolean") patch.starred = body.starred;
  if (typeof body.unread_count === "number" && body.unread_count >= 0) {
    patch.unread_count = Math.floor(body.unread_count);
  }

  let prospectBusiness: string | null | undefined;
  if (body.business_name !== undefined) {
    prospectBusiness = body.business_name?.trim() || null;
    patch.prospect_business_name = prospectBusiness;
    const contactId = (conversation.contact_id as string | null) ?? null;
    const coachIdForContact =
      access.coachId || ((conversation.coach_id as string | null) ?? null);
    if (contactId && coachIdForContact) {
      try {
        const updatedProspect = await updateProspectFields(
          contactId,
          coachIdForContact,
          { business_name: prospectBusiness }
        );
        prospectBusiness = updatedProspect.business_name;
        patch.prospect_business_name = prospectBusiness;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Could not update business name.";
        return NextResponse.json({ error: message }, { status: 400 });
      }
    }
  }

  if (!Object.keys(patch).length) {
    if (prospectBusiness === undefined) {
      return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
    }
    return NextResponse.json({
      conversation,
      prospect: { business_name: prospectBusiness },
    });
  }

  const { data: updated, error } = await supabaseAdmin
    .from("messaging_conversations")
    .update(patch)
    .eq("id", id)
    .select(
      "id, coach_id, contact_id, booking_id, subject, prospect_name, prospect_email, prospect_phone, prospect_avatar_url, prospect_linkedin_url, prospect_business_name, last_message_at, starred, unread_count, last_preview, last_channel"
    )
    .maybeSingle();

  if (error || !updated) {
    console.error("messaging conversation patch:", error);
    return NextResponse.json({ error: "Could not update conversation." }, { status: 500 });
  }

  return NextResponse.json({
    conversation: updated,
    ...(prospectBusiness !== undefined
      ? { prospect: { business_name: prospectBusiness } }
      : {}),
  });
}

/**
 * DELETE /api/messaging/conversations/[id]
 * Hides the thread from the inbox. Provider history is kept so sync cannot resurrect it as a new row.
 */
export async function DELETE(
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

  let q = supabaseAdmin
    .from("messaging_conversations")
    .update({ hidden_at: new Date().toISOString() })
    .eq("id", id);
  if (access.coachId) q = q.eq("coach_id", access.coachId);
  const { error } = await q;

  if (error) {
    console.error("messaging conversation hide:", error);
    return NextResponse.json(
      { error: "Could not delete conversation." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}

/**
 * POST /api/messaging/conversations/[id]
 * Send a reply (JSON or multipart FormData).
 * Fields: channel, body, subject?, email_account_id?, scheduled_for?, attachments[]
 * Email sends from a connected Gmail/Outlook mailbox only.
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
  if (!conversation || conversation.hidden_at) {
    return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  }

  const contentType = request.headers.get("content-type") || "";
  let channel = "email";
  let text = "";
  let subject: string | undefined;
  /** Unipile mailing account id. Empty = auto (this coach's mailbox). */
  let emailAccountId: string | undefined;
  let scheduledFor: string | undefined;
  let attachmentFiles: Array<{ blob: Blob; filename: string; mime: string }> =
    [];
  let voiceFile: { blob: Blob; filename: string; mime: string } | null = null;
  let videoFile: { blob: Blob; filename: string; mime: string } | null = null;

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    channel = String(form.get("channel") || "email")
      .trim()
      .toLowerCase();
    text = String(form.get("body") || "").trim();
    const sub = form.get("subject");
    const ea = form.get("email_account_id");
    const sched = form.get("scheduled_for");
    if (typeof sub === "string" && sub.trim()) subject = sub.trim();
    if (typeof ea === "string" && ea.trim()) emailAccountId = ea.trim();
    if (typeof sched === "string" && sched.trim()) scheduledFor = sched.trim();
    attachmentFiles = await filesFromFormData(form, "attachments");
    const voiceEntries = await filesFromFormData(form, "voice_message");
    const videoEntries = await filesFromFormData(form, "video_message");
    voiceFile = voiceEntries[0] ?? null;
    videoFile = videoEntries[0] ?? null;
  } else {
    const body = (await request.json().catch(() => ({}))) as {
      channel?: string;
      body?: string;
      subject?: string;
      email_account_id?: string;
      scheduled_for?: string;
    };
    channel = (body.channel || "email").trim().toLowerCase();
    text = (body.body || "").trim();
    subject = body.subject?.trim() || undefined;
    emailAccountId = body.email_account_id?.trim() || undefined;
    scheduledFor = body.scheduled_for?.trim() || undefined;
  }

  if (
    !["email", "sms", "comment", "linkedin", "whatsapp", "instagram", "messenger"].includes(
      channel
    )
  ) {
    return NextResponse.json(
      {
        error:
          "Channel must be email, sms, linkedin, whatsapp, instagram, messenger, or comment.",
      },
      { status: 400 }
    );
  }

  const unipileChatChannel =
    channel === "linkedin" ||
    channel === "whatsapp" ||
    channel === "instagram" ||
    channel === "messenger";

  if (attachmentFiles.length > MAX_MESSAGING_ATTACHMENTS) {
    return NextResponse.json(
      {
        error: `You can attach at most ${MAX_MESSAGING_ATTACHMENTS} files.`,
      },
      { status: 400 }
    );
  }

  for (const file of attachmentFiles) {
    const err = validateMessagingAttachment({
      mime: file.mime,
      size: file.blob.size,
      filename: file.filename,
    });
    if (err) {
      return NextResponse.json({ error: err }, { status: 400 });
    }
  }

  if (!text && attachmentFiles.length === 0 && !voiceFile && !videoFile) {
    return NextResponse.json(
      { error: "Message body or attachment is required." },
      { status: 400 }
    );
  }

  if (
    (attachmentFiles.length > 0 || voiceFile || videoFile) &&
    !unipileChatChannel
  ) {
    return NextResponse.json(
      { error: "Attachments are only supported on LinkedIn and similar chat channels." },
      { status: 400 }
    );
  }

  if (scheduledFor && !unipileChatChannel) {
    return NextResponse.json(
      { error: "Schedule send is only available on LinkedIn and similar chat channels." },
      { status: 400 }
    );
  }

  const coachId = conversation.coach_id as string;
  const sender = getBirdSenderDefaults();
  const preview = text.replace(/\s+/g, " ").trim().slice(0, 160);
  const now = new Date().toISOString();

  if (unipileChatChannel) {
    try {
      if (scheduledFor) {
        if (voiceFile || videoFile) {
          return NextResponse.json(
            {
              error:
                "Voice notes and video messages can’t be scheduled yet — send them now.",
            },
            { status: 400 }
          );
        }
        const uploaded: MessagingAttachmentMeta[] = [];
        for (const file of attachmentFiles) {
          uploaded.push(
            await uploadMessagingAttachment({
              coachId,
              conversationId: id,
              blob: file.blob,
              filename: file.filename,
              mime: file.mime,
            })
          );
        }
        const scheduled = await scheduleMessagingReply({
          conversationId: id,
          coachId,
          channel,
          bodyText: text,
          scheduledFor,
          attachments: uploaded,
        });
        return NextResponse.json({ ok: true, scheduled });
      }

      const { replyUnipileConversation } = await import(
        "@/lib/unipile/inboxSync"
      );
      const msg = await replyUnipileConversation({
        coachId,
        conversationId: id,
        text,
        channel,
        attachments: attachmentFiles.map((f) => ({
          blob: f.blob,
          filename: f.filename,
          mime: f.mime,
        })),
        voiceMessage: voiceFile
          ? {
              blob: voiceFile.blob,
              filename: voiceFile.filename,
              mime: voiceFile.mime,
            }
          : undefined,
        videoMessage: videoFile
          ? {
              blob: videoFile.blob,
              filename: videoFile.filename,
              mime: videoFile.mime,
            }
          : undefined,
      });
      const meta = (msg?.metadata as Record<string, unknown> | null) || {};
      const attachments = await signMessagingAttachments(
        parseMessagingAttachments(meta.attachments)
      );
      return NextResponse.json({
        ok: true,
        message: msg
          ? { ...msg, attachments, metadata: { ...meta, attachments } }
          : msg,
      });
    } catch (err) {
      return NextResponse.json(
        {
          error:
            err instanceof Error ? err.message : `${channel} reply failed.`,
        },
        { status: 502 }
      );
    }
  }

  if (channel === "email") {
    if ((emailAccountId || "").toLowerCase() === "bird") {
      return NextResponse.json(
        { error: "Connect Gmail or Outlook to send email from your inbox." },
        { status: 400 }
      );
    }
    const mailingAccounts = (await listOutreachAccounts(coachId)).filter(
      (row) =>
        isMailingProvider(row.provider) &&
        (row.status || "").toUpperCase() === "OK"
    );
    const requestedMailbox = emailAccountId
      ? mailingAccounts.find((row) => row.unipile_account_id === emailAccountId)
      : null;
    if (emailAccountId && !requestedMailbox) {
      return NextResponse.json(
        { error: "That mailbox is not connected (or is offline)." },
        { status: 400 }
      );
    }

    const { data: fullConv } = await supabaseAdmin
      .from("messaging_conversations")
      .select("unipile_account_id, unipile_chat_id")
      .eq("id", id)
      .maybeSingle();
    const linkedMailbox = mailingAccounts.find(
      (row) => row.unipile_account_id === fullConv?.unipile_account_id
    );
    const mailbox =
      requestedMailbox || linkedMailbox || mailingAccounts[0] || null;

    if (!mailbox) {
      return NextResponse.json(
        { error: "Connect Gmail or Outlook to send email from your inbox." },
        { status: 400 }
      );
    }

    try {
      if (subject) {
        await supabaseAdmin
          .from("messaging_conversations")
          .update({ subject })
          .eq("id", id);
      }
      const { replyUnipileConversation } = await import(
        "@/lib/unipile/inboxSync"
      );
      const msg = await replyUnipileConversation({
        coachId,
        conversationId: id,
        text,
        channel: "email",
        accountId: mailbox.unipile_account_id,
      });
      return NextResponse.json({
        ok: true,
        message: msg,
        via: "unipile",
        from: {
          provider: mailbox.provider,
          label: providerLabel(mailbox.provider),
          display_name: mailbox.display_name,
          account_id: mailbox.unipile_account_id,
        },
      });
    } catch (err) {
      console.error("unipile email reply:", err);
      return NextResponse.json(
        {
          error:
            err instanceof Error
              ? err.message
              : "Could not send from your connected mailbox.",
        },
        { status: 502 }
      );
    }
  }

  if (channel === "comment") {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name, first_name, last_name, avatar_url")
      .eq("id", access.userId)
      .maybeSingle();
    const authorName =
      (profile?.full_name as string | null)?.trim() ||
      [profile?.first_name, profile?.last_name].filter(Boolean).join(" ").trim() ||
      "You";
    const authorAvatarUrl =
      (profile?.avatar_url as string | null)?.trim() || null;

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
        metadata: {
          kind: "internal_comment",
          author_user_id: access.userId,
          author_name: authorName,
          author_avatar_url: authorAvatarUrl,
        },
      })
      .select(
        "id, channel, direction, status, subject, body_text, body_html, from_address, to_address, bird_message_id, provider_error, metadata, created_at"
      )
      .maybeSingle();

    if (error || !msg) {
      console.error("internal comment insert:", error);
      return NextResponse.json({ error: "Could not save comment." }, { status: 500 });
    }

    await supabaseAdmin
      .from("messaging_conversations")
      .update({
        ...conversationActivityPatch({
          lastChannel: "system",
          lastDirection: "outbound",
          lastMessageAt: now,
          lastPreview: preview,
        }),
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
      "id, channel, direction, status, subject, body_text, body_html, from_address, to_address, bird_message_id, provider_error, metadata, created_at"
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
      ...conversationActivityPatch({
        lastChannel: "sms",
        lastDirection: "outbound",
        lastMessageAt: now,
        lastPreview: preview,
      }),
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
