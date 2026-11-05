import { getPublicAppBaseUrl } from "@/lib/appBaseUrl";
import { BCA_SUPPORT_EMAIL } from "@/config/businessContact";
import { parseStoredCommunityPostMedia, type CommunityPostMediaItem } from "@/lib/communityPostMedia";
import { getSupportMailboxAccount } from "@/lib/support/mailbox";
import { supportMarkdownToEmailInnerHtml } from "@/lib/support/supportMessageHtml";
import { supportReplyBodyForEmail } from "@/lib/support/supportTicketMedia";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isUnipileConfigured, sendUnipileEmail } from "@/lib/unipile/client";

import { blueprintPage } from "./blueprint";
import { commentPage } from "./pageChat";
import { addSectionComment } from "./sectionComments";
import type { ScheduledComment } from "./sectionCommentTypes";

/**
 * Support's message tools on the Blueprint page chat (5 Nov): attachments,
 * BCA's "email them about this" and scheduled messages.
 */

/** Only files uploaded to our own storage bucket, the way the composer uploads them. */
export function commentMediaFromRequest(raw: unknown): CommunityPostMediaItem[] | { error: string } {
  if (raw == null) return [];
  const items = parseStoredCommunityPostMedia(raw) ?? [];
  const base = `${(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "")}/storage/v1/object/public/community-posts/`;
  const ours = (url: string | undefined) => !url || url.startsWith(base);
  if (items.some((item) => !ours(item.url) || !ours(item.poster))) {
    return { error: "That attachment could not be used." };
  }
  return items;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Email the coach that BCA wrote in their Blueprint chat, from the support mailbox. */
export async function emailCoachAboutComment(input: {
  coachId: string;
  sectionKey: string;
  authorId: string | null;
  body: string;
  media: CommunityPostMediaItem[];
  request?: Request;
}): Promise<{ ok: true; emailed: string } | { ok: false; error: string }> {
  if (!isUnipileConfigured()) return { ok: false, error: "Email isn't set up (Unipile)." };
  const mailbox = await getSupportMailboxAccount();
  if (!mailbox) return { ok: false, error: "Connect the support mailbox (Admin → Support) before emailing coaches." };
  if (mailbox.status && mailbox.status !== "OK") {
    return { ok: false, error: `The support mailbox needs reconnecting (${mailbox.status}).` };
  }

  const { data: user } = await supabaseAdmin.auth.admin.getUserById(input.coachId);
  const email = user.user?.email?.trim().toLowerCase();
  if (!email) return { ok: false, error: "This coach has no email address." };

  const ids = [input.coachId, input.authorId].filter((id): id is string => Boolean(id));
  const { data: people } = await supabaseAdmin.from("profiles").select("id, full_name, first_name").in("id", ids);
  const coach = people?.find((p) => p.id === input.coachId);
  const author = input.authorId ? people?.find((p) => p.id === input.authorId) : null;
  const coachName = coach?.full_name?.trim() || null;
  const signature = author?.first_name?.trim() || author?.full_name?.trim().split(/\s+/)[0] || "BCA";

  const slug = commentPage(input.sectionKey);
  const page = slug ? blueprintPage(slug) : null;
  const pageTitle = page?.title ?? "your Blueprint";
  const url = `${getPublicAppBaseUrl(input.request)}${page?.href ?? "/coach/blueprint"}`;

  const text = supportReplyBodyForEmail(input.body, input.media).slice(0, 4000);
  const html = `<p style="margin:0 0 20px;">${supportMarkdownToEmailInnerHtml(text)}</p>
<p style="color:#334155;font-size:14px;margin:0 0 20px;"><a href="${escapeHtml(url)}" style="color:#0369a1;text-decoration:underline;">Open ${escapeHtml(pageTitle)} in your Blueprint</a> to see it and reply.</p>
<p style="color:#334155;font-size:14px;margin:0;">${escapeHtml(signature)}</p>`;

  const to = [{ identifier: email, ...(coachName ? { display_name: coachName } : {}) }];
  const subject = `New message on ${pageTitle}`;
  let res = await sendUnipileEmail({
    account_id: mailbox.unipile_account_id,
    to,
    from: { identifier: BCA_SUPPORT_EMAIL, display_name: "Profit Coach Support" },
    subject,
    body: html,
  });
  // Gmail sometimes rejects a custom From; the connected mailbox is already support@.
  if (!res.ok) res = await sendUnipileEmail({ account_id: mailbox.unipile_account_id, to, subject, body: html });
  if (!res.ok) return { ok: false, error: res.error || "Could not send the email." };
  return { ok: true, emailed: email };
}

const SCHEDULED_COLUMNS = "id, section_key, body, media, email_notify, scheduled_for, status, last_error";

type ScheduledRow = {
  id: string;
  coach_id?: string;
  section_key: string;
  author_id?: string | null;
  body: string;
  media: unknown;
  email_notify: boolean;
  scheduled_for: string;
  status: string;
  last_error: string | null;
  attempts?: number;
};

function toScheduled(row: ScheduledRow): ScheduledComment {
  return {
    id: row.id,
    section_key: row.section_key,
    body: row.body,
    media: parseStoredCommunityPostMedia(row.media) ?? [],
    email_notify: row.email_notify,
    scheduled_for: row.scheduled_for,
    status: row.status === "failed" ? "failed" : "scheduled",
    last_error: row.last_error,
  };
}

/** Waiting (or failed) scheduled messages on one coach's Blueprint, soonest first. */
export async function listScheduledComments(coachId: string): Promise<ScheduledComment[]> {
  const { data, error } = await supabaseAdmin
    .from("practice_scheduled_comments")
    .select(SCHEDULED_COLUMNS)
    .eq("coach_id", coachId)
    .in("status", ["scheduled", "failed"])
    .order("scheduled_for", { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as ScheduledRow[]).map(toScheduled);
}

export async function scheduleComment(opts: {
  coachId: string;
  sectionKey: string;
  authorId: string;
  body: string;
  media: CommunityPostMediaItem[];
  emailNotify: boolean;
  scheduledFor: Date;
}): Promise<ScheduledComment> {
  const { data, error } = await supabaseAdmin
    .from("practice_scheduled_comments")
    .insert({
      coach_id: opts.coachId,
      section_key: opts.sectionKey,
      author_id: opts.authorId,
      body: opts.body,
      media: opts.media.length ? opts.media : null,
      email_notify: opts.emailNotify,
      scheduled_for: opts.scheduledFor.toISOString(),
    })
    .select(SCHEDULED_COLUMNS)
    .single();
  if (error || !data) throw new Error(error?.message ?? "Could not schedule the message.");
  return toScheduled(data as ScheduledRow);
}

export async function cancelScheduledComment(coachId: string, id: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("practice_scheduled_comments")
    .update({ status: "cancelled" })
    .eq("id", id)
    .eq("coach_id", coachId)
    .in("status", ["scheduled", "failed"])
    .select("id");
  if (error) throw new Error(error.message);
  return Boolean(data?.length);
}

/**
 * Post due scheduled messages into the chat (and email the coach when asked).
 * Runs from the every-minute support cron, and when BCA opens a chat with one
 * due, so it also works where there is no cron (local, staging).
 */
export async function processDueScheduledComments(
  opts: { coachId?: string; limit?: number; request?: Request } = {}
): Promise<{ sent: number; failed: number; errors: string[] }> {
  let query = supabaseAdmin
    .from("practice_scheduled_comments")
    .select(`${SCHEDULED_COLUMNS}, coach_id, author_id, attempts`)
    .eq("status", "scheduled")
    .lte("scheduled_for", new Date().toISOString())
    .order("scheduled_for", { ascending: true })
    .limit(opts.limit ?? 15);
  if (opts.coachId) query = query.eq("coach_id", opts.coachId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);

  let sent = 0;
  let failed = 0;
  const errors: string[] = [];
  for (const row of (data ?? []) as ScheduledRow[]) {
    // Claim it first, so the cron and an open chat never post it twice.
    const { data: claimed } = await supabaseAdmin
      .from("practice_scheduled_comments")
      .update({ status: "sending", attempts: (row.attempts ?? 0) + 1 })
      .eq("id", row.id)
      .eq("status", "scheduled")
      .select("id");
    if (!claimed?.length) continue;

    try {
      const media = parseStoredCommunityPostMedia(row.media) ?? [];
      const comment = await addSectionComment({
        coachId: row.coach_id!,
        sectionKey: row.section_key,
        authorId: row.author_id ?? null,
        side: "bca",
        body: row.body,
        media,
      });
      let lastError: string | null = null;
      if (row.email_notify) {
        const mail = await emailCoachAboutComment({
          coachId: row.coach_id!,
          sectionKey: row.section_key,
          authorId: row.author_id ?? null,
          body: row.body,
          media,
          request: opts.request,
        });
        if (!mail.ok) lastError = `Posted, but the email failed: ${mail.error}`;
      }
      await supabaseAdmin
        .from("practice_scheduled_comments")
        .update({ status: "sent", comment_id: comment.id, last_error: lastError })
        .eq("id", row.id);
      sent += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not post the message.";
      await supabaseAdmin.from("practice_scheduled_comments").update({ status: "failed", last_error: message }).eq("id", row.id);
      failed += 1;
      errors.push(message);
    }
  }
  return { sent, failed, errors };
}
