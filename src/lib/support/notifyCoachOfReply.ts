import { getAppBaseUrl } from "@/lib/appBaseUrl";
import { BCA_SUPPORT_EMAIL } from "@/config/businessContact";
import { getSupportMailboxAccount } from "@/lib/support/mailbox";
import {
  buildSupportCallBookingUrl,
  loadSupportCallContactPrefill,
  resolveSupportCallHostSlug,
} from "@/lib/support/supportCallPrefill";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { SupportTicketSource } from "@/lib/support/tickets";
import {
  getUnipileEmail,
  isUnipileConfigured,
  sendUnipileEmail,
} from "@/lib/unipile/client";

/** Quiet period after the last staff reply before sending one email. */
export const SUPPORT_EMAIL_NOTIFY_DEBOUNCE_MS = 4 * 60 * 1000;

export type SupportNotifyRecipient = {
  email: string;
  name: string | null;
  isMember: boolean;
};

type StaffReplyForEmail = {
  body: string;
  authorFirstName: string | null;
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

function staffReplyIntro(authorNames: string[]): string {
  const unique = [...new Set(authorNames.map((n) => n.trim()).filter(Boolean))];
  if (unique.length === 1) {
    return `${unique[0]} from Profit Coach Support replied to your request:`;
  }
  if (unique.length === 2) {
    return `${unique[0]} and ${unique[1]} from Profit Coach Support replied to your request:`;
  }
  return "The Profit Coach support team replied to your request:";
}

function formatStaffReplyBodies(replies: StaffReplyForEmail[]): string {
  const names = [
    ...new Set(
      replies.map((r) => r.authorFirstName?.trim() || "").filter(Boolean)
    ),
  ];
  if (names.length <= 1) {
    return replies.map((r) => r.body).join("\n\n");
  }
  return replies
    .map((r) => {
      const who = r.authorFirstName?.trim();
      return who ? `${who}:\n${r.body}` : r.body;
    })
    .join("\n\n");
}

/**
 * Flush due queued notify emails. Call from cron (~every minute).
 */
export async function processDueSupportReplyEmails(
  limit = 25,
  request?: Request
): Promise<{ processed: number; sent: number; errors: string[] }> {
  const nowIso = new Date().toISOString();
  const { data: due, error } = await supabaseAdmin
    .from("community_feedback_reports")
    .select(
      "id, ticket_number, title, created_by, contact_email, submitter_name, assigned_to, member_notify_email, email_notify_after, email_notify_last_sent_at, unipile_email_id, unipile_thread_id, unipile_account_id"
    )
    .not("email_notify_after", "is", null)
    .lte("email_notify_after", nowIso)
    .limit(limit);

  if (error) {
    return { processed: 0, sent: 0, errors: [error.message] };
  }

  let sent = 0;
  const errors: string[] = [];

  for (const ticket of due ?? []) {
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

    const recipient = await resolveSupportNotifyRecipient(ticket);
    if (!recipient) {
      errors.push(`${ticket.id}: no recipient email`);
      continue;
    }

    const since = ticket.email_notify_last_sent_at ?? "1970-01-01T00:00:00.000Z";
    const { data: replies, error: repliesError } = await supabaseAdmin
      .from("community_feedback_replies")
      .select(
        "body, created_at, created_by, author:profiles!created_by ( role, full_name, first_name )"
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

    const staffReplies: StaffReplyForEmail[] = (replies ?? [])
      .filter((r) => {
        const author = Array.isArray(r.author) ? r.author[0] : r.author;
        const role = (author as { role?: string | null } | null)?.role;
        if (role === "admin") return true;
        return Boolean(ticket.created_by && r.created_by !== ticket.created_by);
      })
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
        };
      })
      .filter((r) => Boolean(r.body));

    if (staffReplies.length === 0) {
      continue;
    }

    const replyBody = formatStaffReplyBodies(staffReplies);
    const authorNames = staffReplies
      .map((r) => r.authorFirstName)
      .filter((n): n is string => Boolean(n));

    const hostSlug = await resolveSupportCallHostSlug(
      (ticket as { assigned_to?: string | null }).assigned_to
    );
    const contactPrefill = ticket.created_by
      ? await loadSupportCallContactPrefill(ticket.created_by)
      : {
          firstName: ticket.submitter_name?.trim()?.split(/\s+/)[0] || null,
          lastName:
            ticket.submitter_name?.trim()?.split(/\s+/).slice(1).join(" ") ||
            null,
          email: recipient.email,
          phone: null,
        };
    if (!contactPrefill.email) {
      contactPrefill.email = recipient.email;
    }

    const result = await notifyCoachOfSupportReply({
      ticketId: ticket.id,
      title: ticket.title,
      replyBody,
      intro: staffReplyIntro(authorNames),
      recipient,
      unipileEmailId: ticket.unipile_email_id,
      supportCallUrl: buildSupportCallBookingUrl({
        baseUrl: getAppBaseUrl(request),
        hostSlug,
        contact: contactPrefill,
      }),
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

    await supabaseAdmin
      .from("community_feedback_reports")
      .update({ email_notify_last_sent_at: new Date().toISOString() })
      .eq("id", ticket.id);
    sent += 1;
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
  intro: string;
  recipient: SupportNotifyRecipient;
  unipileEmailId?: string | null;
  /** Prefillable /support-call-* link for the assignee host. */
  supportCallUrl?: string | null;
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
  const supportCallUrl = input.supportCallUrl?.trim() || null;
  const preview = input.replyBody.trim().slice(0, 2000);
  const greeting = `Hi${
    input.recipient.name ? ` ${input.recipient.name.split(" ")[0]}` : ""
  },`;
  const outro =
    "You can reply to this email, open Support in the app, or book a short call — whichever is easiest.";

  const callButton = supportCallUrl
    ? `<p><a href="${escapeHtml(
        supportCallUrl
      )}" style="display:inline-block;background:#0f766e;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:600;margin-right:8px;">Book a support call</a>
<a href="${escapeHtml(
        supportUrl
      )}" style="display:inline-block;background:#0369a1;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:600;">Open Support</a></p>`
    : `<p><a href="${escapeHtml(
        supportUrl
      )}" style="display:inline-block;background:#0369a1;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:600;">Open Support</a></p>`;

  const html = `<p>${escapeHtml(greeting)}</p>
<p>${escapeHtml(input.intro)}${
    subjectTitle !== "your support request"
      ? ` <strong>${escapeHtml(subjectTitle)}</strong>`
      : ""
  }</p>
<blockquote style="margin:16px 0;padding:12px 16px;border-left:3px solid #0c5290;background:#f8fafc;white-space:pre-wrap;">${escapeHtml(
    preview
  )}</blockquote>
<p style="color:#334155;font-size:14px;">${escapeHtml(outro)}</p>
${callButton}
<p style="color:#64748b;font-size:13px;">— Profit Coach Support</p>`;

  // Always RE: so member inbox shows a reply, not a bare ticket title.
  const subjectBase = /^(re|RE|Re):\s*/i.test(subjectTitle)
    ? subjectTitle.replace(/^(re|RE|Re):\s*/i, "").trim() || subjectTitle
    : subjectTitle;
  const subject = `RE: ${subjectBase}`.slice(0, 200);

  const res = await sendUnipileEmail({
    account_id: mailbox.unipile_account_id,
    to: [
      {
        identifier: input.recipient.email,
        ...(input.recipient.name
          ? { display_name: input.recipient.name }
          : {}),
      },
    ],
    from: {
      identifier: BCA_SUPPORT_EMAIL,
      display_name: "Profit Coach Support",
    },
    subject,
    body: html,
    reply_to: input.unipileEmailId || undefined,
  });

  if (!res.ok) {
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
