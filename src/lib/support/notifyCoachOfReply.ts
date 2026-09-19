import { getAppBaseUrl } from "@/lib/appBaseUrl";
import { BCA_SUPPORT_EMAIL } from "@/config/businessContact";
import type { CommunityPostMediaItem } from "@/lib/communityPostMedia";
import { getSupportMailboxAccount } from "@/lib/support/mailbox";
import {
  parseSupportReplyMedia,
  supportEmailAttachmentFilename,
  supportReplyBodyForEmail,
} from "@/lib/support/supportTicketMedia";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { SupportTicketSource } from "@/lib/support/tickets";
import {
  getUnipileEmail,
  isUnipileConfigured,
  sendUnipileEmail,
} from "@/lib/unipile/client";

/**
 * Delay before a queued notify is due. Kept at 0 so the admin reply request
 * (and the minute cron) can send immediately — the old 4-minute window left
 * mail sitting in the queue when cron auth failed.
 */
export const SUPPORT_EMAIL_NOTIFY_DEBOUNCE_MS = 0;

export type SupportNotifyRecipient = {
  email: string;
  name: string | null;
  isMember: boolean;
};

type StaffReplyForEmail = {
  body: string;
  authorFirstName: string | null;
  media: CommunityPostMediaItem[];
};

/**
 * Resolve who should get an email about a staff reply.
 * Prefer the linked member's auth email; fall back to ticket contact_email.
 */
export async function resolveSupportNotifyRecipient(ticket: {
  created_by: string | null;
  contact_email: string | null;
  submitter_name: string | null;
}): Promise<SupportNotifyRecipient | null> {
  if (ticket.created_by) {
    try {
      const { data, error } = await supabaseAdmin.auth.admin.getUserById(
        ticket.created_by
      );
      const email = data.user?.email?.trim().toLowerCase();
      if (!error && email) {
        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("full_name, first_name, last_name")
          .eq("id", ticket.created_by)
          .maybeSingle();
        const name =
          profile?.full_name?.trim() ||
          [profile?.first_name, profile?.last_name]
            .filter(Boolean)
            .join(" ")
            .trim() ||
          ticket.submitter_name?.trim() ||
          null;
        return { email, name, isMember: true };
      }
    } catch {
      /* fall through */
    }
  }

  const email = ticket.contact_email?.trim().toLowerCase() || null;
  if (!email) return null;
  return {
    email,
    name: ticket.submitter_name?.trim() || null,
    isMember: Boolean(ticket.created_by),
  };
}

export function supportNotifyDefaultOn(
  source: SupportTicketSource | string | null | undefined,
  memberNotifyEmail?: boolean | null
): boolean {
  if (memberNotifyEmail === false) return false;
  if (memberNotifyEmail === true) return true;
  return source === "email_inbox" || source === "public_form";
}

/**
 * Schedule (or re-bump) a debounced email notify for this ticket.
 * Multiple replies within the quiet window collapse into one email.
 */
export async function queueSupportReplyEmailNotify(
  ticketId: string
): Promise<{ ok: true; sendAfter: string } | { ok: false; error: string }> {
  if (!isUnipileConfigured()) {
    return { ok: false, error: "Unipile is not configured." };
  }
  const mailbox = await getSupportMailboxAccount();
  if (!mailbox) {
    return {
      ok: false,
      error:
        "Connect the support mailbox (Admin → Support) before emailing members.",
    };
  }
  if (mailbox.status && mailbox.status !== "OK") {
    return {
      ok: false,
      error: `Support mailbox status is ${mailbox.status}. Reconnect it before emailing.`,
    };
  }

  const sendAfter = new Date(
    Date.now() + SUPPORT_EMAIL_NOTIFY_DEBOUNCE_MS
  ).toISOString();

  const { error } = await supabaseAdmin
    .from("community_feedback_reports")
    .update({ email_notify_after: sendAfter })
    .eq("id", ticketId);

  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true, sendAfter };
}

function firstNameOf(profile: {
  full_name?: string | null;
  first_name?: string | null;
} | null): string | null {
  const first = profile?.first_name?.trim();
  if (first) return first;
  const full = profile?.full_name?.trim();
  if (!full) return null;
  return full.split(/\s+/)[0] || null;
}

function lastStaffSignature(replies: StaffReplyForEmail[]): string | null {
  for (let i = replies.length - 1; i >= 0; i -= 1) {
    const name = replies[i]?.authorFirstName?.trim();
    if (name) return name;
  }
  return null;
}

export function buildSupportReplyEmailHtml(input: {
  replyBody: string;
  signatureName: string | null;
  supportUrl: string;
}): string {
  const preview = input.replyBody.trim().slice(0, 2000);
  const bodyHtml = escapeHtml(preview).replace(/\n/g, "<br>");
  const signature = input.signatureName?.trim() || "Profit Coach Support";
  return `<p style="margin:0 0 20px;">${bodyHtml}</p>
<p style="color:#334155;font-size:14px;margin:0 0 20px;">You can reply to this email or <a href="${escapeHtml(
    input.supportUrl
  )}" style="color:#0369a1;text-decoration:underline;">open Support in the app</a>, whichever is easiest.</p>
<p style="color:#334155;font-size:14px;margin:0;">${escapeHtml(signature)}</p>`;
}

function formatStaffReplyBodies(replies: StaffReplyForEmail[]): string {
  const names = [
    ...new Set(
      replies.map((r) => r.authorFirstName?.trim() || "").filter(Boolean)
    ),
  ];
  if (names.length <= 1) {
    return replies
      .map((r) => supportReplyBodyForEmail(r.body, r.media))
      .filter(Boolean)
      .join("\n\n");
  }
  return replies
    .map((r) => {
      const body = supportReplyBodyForEmail(r.body, r.media);
      if (!body) return "";
      const who = r.authorFirstName?.trim();
      return who ? `${who}:\n${body}` : body;
    })
    .filter(Boolean)
    .join("\n\n");
}

const EMAIL_ATTACHMENT_MAX_BYTES = 20 * 1024 * 1024;

async function emailAttachmentsFromSupportMedia(
  media: CommunityPostMediaItem[]
): Promise<Array<{ blob: Blob; filename: string }>> {
  const seen = new Set<string>();
  const files: Array<{ blob: Blob; filename: string }> = [];
  for (const [index, item] of media.entries()) {
    const url = item.url.trim();
    if (!url || seen.has(url)) continue;
    seen.add(url);
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
      if (!res.ok) continue;
      const buf = await res.arrayBuffer();
      if (!buf.byteLength || buf.byteLength > EMAIL_ATTACHMENT_MAX_BYTES) {
        continue;
      }
      const type =
        res.headers.get("content-type")?.split(";")[0]?.trim() ||
        "application/octet-stream";
      files.push({
        blob: new Blob([buf], { type }),
        filename: supportEmailAttachmentFilename(item, index),
      });
    } catch (err) {
      console.warn("support notify attachment:", err);
    }
  }
  return files;
}

/**
 * Flush due queued notify emails. Call from cron (~every minute).
 */
export async function processDueSupportReplyEmails(
  limit = 25,
  request?: Request,
  onlyTicketId?: string
): Promise<{ processed: number; sent: number; errors: string[] }> {
  const nowIso = new Date().toISOString();
  let query = supabaseAdmin
    .from("community_feedback_reports")
    .select(
      "id, ticket_number, title, created_by, contact_email, submitter_name, member_notify_email, email_notify_after, email_notify_last_sent_at, unipile_email_id, unipile_thread_id, unipile_account_id"
    )
    .not("email_notify_after", "is", null)
    .lte("email_notify_after", nowIso);
  if (onlyTicketId) {
    query = query.eq("id", onlyTicketId);
  }
  const { data: due, error } = await query.limit(limit);

  if (error) {
    return { processed: 0, sent: 0, errors: [error.message] };
  }

  let sent = 0;
  const errors: string[] = [];

  for (const ticket of due ?? []) {
    let claimed = false;
    try {
    // Clear queue first so a crash mid-send doesn't double-spam forever;
    // we re-queue on failure below if needed.
    const clear = await supabaseAdmin
      .from("community_feedback_reports")
      .update({ email_notify_after: null })
      .eq("id", ticket.id)
      .eq("email_notify_after", ticket.email_notify_after);

    if (clear.error) {
      errors.push(`${ticket.id}: ${clear.error.message}`);
      continue;
    }
    claimed = true;

    const recipient = await resolveSupportNotifyRecipient(ticket);
    if (!recipient) {
      errors.push(`${ticket.id}: no recipient email`);
      continue;
    }

    const since = ticket.email_notify_last_sent_at ?? "1970-01-01T00:00:00.000Z";
    const { data: replies, error: repliesError } = await supabaseAdmin
      .from("community_feedback_replies")
      .select(
        "id, body, media, created_at, created_by, author:profiles!created_by ( role, full_name, first_name )"
      )
      .eq("report_id", ticket.id)
      .gt("created_at", since)
      .order("created_at", { ascending: true });

    if (repliesError) {
      errors.push(`${ticket.id}: ${repliesError.message}`);
      await supabaseAdmin
        .from("community_feedback_reports")
        .update({ email_notify_after: ticket.email_notify_after })
        .eq("id", ticket.id);
      continue;
    }

    const staffRows = (replies ?? []).filter((r) => {
      const author = Array.isArray(r.author) ? r.author[0] : r.author;
      const role = (author as { role?: string | null } | null)?.role;
      if (role === "admin") return true;
      return Boolean(ticket.created_by && r.created_by !== ticket.created_by);
    });
    const staffReplies: StaffReplyForEmail[] = staffRows
      .map((r) => {
        const author = Array.isArray(r.author) ? r.author[0] : r.author;
        return {
          body: (r.body ?? "").trim(),
          authorFirstName: firstNameOf(
            author as {
              full_name?: string | null;
              first_name?: string | null;
            } | null
          ),
          media: parseSupportReplyMedia(r.media),
        };
      })
      .filter((r) => Boolean(r.body) || r.media.length > 0);
    const staffReplyIds = staffRows
      .filter((r) => {
        const body = (r.body ?? "").trim();
        return Boolean(body) || parseSupportReplyMedia(r.media).length > 0;
      })
      .map((r) => r.id as string)
      .filter(Boolean);

    if (staffReplies.length === 0) {
      continue;
    }

    const replyBody = formatStaffReplyBodies(staffReplies);
    const attachments = await emailAttachmentsFromSupportMedia(
      staffReplies.flatMap((r) => r.media)
    );

    const result = await notifyCoachOfSupportReply({
      ticketId: ticket.id,
      title: ticket.title,
      replyBody,
      signatureName: lastStaffSignature(staffReplies),
      recipient,
      unipileEmailId: ticket.unipile_email_id,
      attachments,
      request,
    });

    if (!result.ok) {
      errors.push(`${ticket.id}: ${result.error || "send failed"}`);
      await supabaseAdmin
        .from("community_feedback_reports")
        .update({ email_notify_after: new Date().toISOString() })
        .eq("id", ticket.id);
      continue;
    }

    if (staffReplyIds.length > 0) {
      await supabaseAdmin
        .from("community_feedback_replies")
        .update({ via_email: true })
        .in("id", staffReplyIds);
    }

    await supabaseAdmin
      .from("community_feedback_reports")
      .update({ email_notify_last_sent_at: new Date().toISOString() })
      .eq("id", ticket.id);
    sent += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : "send failed";
      errors.push(`${ticket.id}: ${message}`);
      console.error("support reply email:", ticket.id, err);
      if (claimed) {
        await supabaseAdmin
          .from("community_feedback_reports")
          .update({ email_notify_after: new Date().toISOString() })
          .eq("id", ticket.id);
      }
    }
  }

  return { processed: (due ?? []).length, sent, errors };
}

async function linkTicketToOutboundEmail(input: {
  ticketId: string;
  accountId: string;
  trackingId?: string | null;
  providerId?: string | null;
  existingEmailId?: string | null;
}): Promise<void> {
  const lookupId = input.trackingId || input.providerId;
  let emailId = input.trackingId || null;
  let threadId: string | null = null;

  if (lookupId) {
    const got = await getUnipileEmail(lookupId, input.accountId);
    if (got.ok && got.data) {
      emailId = got.data.id || emailId;
      threadId = got.data.thread_id?.trim() || null;
    }
  }

  const patch: Record<string, unknown> = {
    unipile_account_id: input.accountId,
  };
  if (threadId) patch.unipile_thread_id = threadId;
  // Prefer keeping an existing inbound id for reply_to chains; otherwise store outbound.
  if (!input.existingEmailId && emailId) {
    patch.unipile_email_id = emailId;
  }

  await supabaseAdmin
    .from("community_feedback_reports")
    .update(patch)
    .eq("id", input.ticketId);
}

export async function notifyCoachOfSupportReply(input: {
  ticketId: string;
  title: string | null;
  replyBody: string;
  signatureName: string | null;
  recipient: SupportNotifyRecipient;
  unipileEmailId?: string | null;
  attachments?: Array<{ blob: Blob; filename: string }>;
  request?: Request;
}): Promise<{ ok: boolean; error?: string }> {
  if (!isUnipileConfigured()) {
    return { ok: false, error: "Unipile is not configured." };
  }

  const mailbox = await getSupportMailboxAccount();
  if (!mailbox) {
    return {
      ok: false,
      error:
        "Connect the support mailbox (Admin → Support) before emailing members.",
    };
  }
  if (mailbox.status && mailbox.status !== "OK") {
    return {
      ok: false,
      error: `Support mailbox status is ${mailbox.status}. Reconnect it before emailing.`,
    };
  }

  const base = getAppBaseUrl(input.request);
  const subjectTitle = (input.title || "").trim() || "your support request";
  const supportUrl = `${base}/coach/support`;
  const html = buildSupportReplyEmailHtml({
    replyBody: input.replyBody,
    signatureName: input.signatureName,
    supportUrl,
  });

  // Always RE: so member inbox shows a reply, not a bare ticket title.
  const subjectBase = /^(re|RE|Re):\s*/i.test(subjectTitle)
    ? subjectTitle.replace(/^(re|RE|Re):\s*/i, "").trim() || subjectTitle
    : subjectTitle;
  const subject = `RE: ${subjectBase}`.slice(0, 200);

  const to = [
    {
      identifier: input.recipient.email,
      ...(input.recipient.name ? { display_name: input.recipient.name } : {}),
    },
  ];
  const from = {
    identifier: BCA_SUPPORT_EMAIL,
    display_name: "Profit Coach Support",
  };
  const replyTo = input.unipileEmailId?.trim() || undefined;

  let res = await sendUnipileEmail({
    account_id: mailbox.unipile_account_id,
    to,
    from,
    subject,
    body: html,
    reply_to: replyTo,
    attachments: input.attachments,
  });

  // Stale inbound ids fail with parent_mail_not_found; retry as a new thread.
  if (!res.ok && replyTo) {
    console.warn("support notify reply_to failed, retrying:", res.error);
    res = await sendUnipileEmail({
      account_id: mailbox.unipile_account_id,
      to,
      from,
      subject,
      body: html,
      attachments: input.attachments,
    });
  }

  // Gmail sometimes rejects a custom From; the connected mailbox is already support@.
  if (!res.ok) {
    console.warn("support notify from failed, retrying without from:", res.error);
    res = await sendUnipileEmail({
      account_id: mailbox.unipile_account_id,
      to,
      subject,
      body: html,
      attachments: input.attachments,
    });
  }

  if (!res.ok) {
    console.error("support notify send failed:", res.error);
    return { ok: false, error: res.error || "Could not send email." };
  }

  await linkTicketToOutboundEmail({
    ticketId: input.ticketId,
    accountId: mailbox.unipile_account_id,
    trackingId: res.data?.tracking_id,
    providerId: res.data?.provider_id,
    existingEmailId: input.unipileEmailId,
  }).catch((err) => {
    console.warn("support notify link thread:", err);
  });

  return { ok: true };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
