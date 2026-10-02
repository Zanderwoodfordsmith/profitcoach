import type { CommunityPostMediaItem } from "@/lib/communityPostMedia";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  processDueSupportReplyEmails,
  queueSupportReplyEmailNotify,
} from "@/lib/support/notifyCoachOfReply";
import {
  normalizeSupportTicketStatus,
  supportStatusAfterStaffReply,
} from "@/lib/support/tickets";

/** Matches the messaging inbox: don't schedule into the past minute. */
export const SUPPORT_SCHEDULE_MIN_LEAD_MS = 60_000;

export function assertFutureSchedule(iso: string, now = Date.now()): Date {
  const when = new Date(iso);
  if (Number.isNaN(when.getTime())) {
    throw new Error("Invalid schedule time.");
  }
  if (when.getTime() < now + SUPPORT_SCHEDULE_MIN_LEAD_MS) {
    throw new Error("Schedule at least one minute in the future.");
  }
  return when;
}

type DueRow = {
  id: string;
  report_id: string;
  created_by: string;
  body: string;
  media: CommunityPostMediaItem[] | null;
  email_notify: boolean;
  attempts: number;
};

/**
 * Insert due support replies and email the member when that was requested.
 * Called from the support-reply cron (every minute).
 */
export async function processDueScheduledSupportReplies(
  limit = 15,
  request?: Request
): Promise<{
  processed: number;
  sent: number;
  failed: number;
  errors: string[];
}> {
  const now = new Date().toISOString();
  const { data: due, error } = await supabaseAdmin
    .from("support_scheduled_replies")
    .select(
      "id, report_id, created_by, body, media, email_notify, attempts, scheduled_for"
    )
    .eq("status", "scheduled")
    .lte("scheduled_for", now)
    .order("scheduled_for", { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const raw of due ?? []) {
    const row = raw as DueRow;
    const claimed = await claimScheduledReply(row);
    if (!claimed) continue;

    try {
      await deliverScheduledReply(row, request);
      sent += 1;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Scheduled reply failed.";
      failed += 1;
      errors.push(`${row.id}: ${message}`);
      await supabaseAdmin
        .from("support_scheduled_replies")
        .update({
          status: "failed",
          last_error: message.slice(0, 500),
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id)
        .eq("status", "sending");
    }
  }

  return {
    processed: (due ?? []).length,
    sent,
    failed,
    errors,
  };
}

async function claimScheduledReply(row: DueRow): Promise<boolean> {
  const { data: claimed } = await supabaseAdmin
    .from("support_scheduled_replies")
    .update({
      status: "sending",
      attempts: (row.attempts || 0) + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", row.id)
    .eq("status", "scheduled")
    .select("id")
    .maybeSingle();
  return Boolean(claimed);
}

async function deliverScheduledReply(
  row: DueRow,
  request?: Request
): Promise<void> {
  const body = row.body?.trim() ?? "";
  const media = Array.isArray(row.media) && row.media.length > 0 ? row.media : null;
  if (!body && !media) {
    throw new Error("Scheduled reply is empty.");
  }

  const { data: reply, error: insertError } = await supabaseAdmin
    .from("community_feedback_replies")
    .insert({
      report_id: row.report_id,
      created_by: row.created_by,
      body: body || "Sent an attachment",
      media,
      via_email: false,
    })
    .select("id")
    .single();

  if (insertError || !reply) {
    throw new Error(insertError?.message || "Could not save the reply.");
  }

  const { data: ticket } = await supabaseAdmin
    .from("community_feedback_reports")
    .select("status")
    .eq("id", row.report_id)
    .maybeSingle();

  const nextStatus = supportStatusAfterStaffReply(
    normalizeSupportTicketStatus(ticket?.status)
  );
  if (nextStatus) {
    await supabaseAdmin
      .from("community_feedback_reports")
      .update({ status: nextStatus })
      .eq("id", row.report_id);
  }

  // Mark sent before the email so a slow Unipile call cannot insert the reply twice.
  await supabaseAdmin
    .from("support_scheduled_replies")
    .update({
      status: "sent",
      reply_id: reply.id,
      last_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", row.id);

  if (!row.email_notify || !body) return;

  const queued = await queueSupportReplyEmailNotify(row.report_id);
  if (!queued.ok) {
    await supabaseAdmin
      .from("support_scheduled_replies")
      .update({
        last_error: (queued.error || "Could not queue email.").slice(0, 500),
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);
    return;
  }

  const flushed = await processDueSupportReplyEmails(1, request, row.report_id);
  const thisError = flushed.errors.find((entry) =>
    entry.startsWith(`${row.report_id}:`)
  );
  if (thisError) {
    await supabaseAdmin
      .from("support_scheduled_replies")
      .update({
        last_error: thisError.slice(0, 500),
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);
  }
}
