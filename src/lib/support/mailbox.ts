/**
 * Dedicated Support mailbox (Unipile GOOGLE/OUTLOOK).
 *
 * Isolated from coach CRM: rows live in platform_unipile_accounts only.
 * Mail webhooks for these account ids never touch messaging_*.
 */
import { getAppBaseUrl } from "@/lib/appBaseUrl";
import { BCA_SUPPORT_EMAIL } from "@/config/businessContact";
import { DEFAULT_SUPPORT_ASSIGNEE_ID } from "@/lib/support/assignees";
import {
  sendSupportEmailReceiptAck,
  shouldAutoAckSupportEmail,
} from "@/lib/support/emailReceiptAck";
import {
  maybeFillProfilePhoneFromEmailBody,
  parseSupportTicketNumberFromSubject,
  stripEmailQuotedReply,
} from "@/lib/support/ingestEmailReply";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  createHostedAuthLink,
  deleteUnipileAccount,
  deleteUnipileEmail,
  getUnipileAccount,
  getUnipileEmail,
  isUnipileConfigured,
  listUnipileAccounts,
  listUnipileEmails,
  updateUnipileEmail,
} from "@/lib/unipile/client";
import {
  displayNameFromUnipileAccount,
  isMailingProvider,
  normalizeUnipileProvider,
} from "@/lib/unipile/providers";

/** Hosted-auth `name` prefix for the support mailbox (not a coach UUID). */
export const SUPPORT_MAILBOX_NOTIFY_PREFIX = "platform-support";

export function isSupportMailboxNotifyName(name: string): boolean {
  const n = name.trim().toLowerCase();
  return (
    n === SUPPORT_MAILBOX_NOTIFY_PREFIX ||
    n.startsWith(`${SUPPORT_MAILBOX_NOTIFY_PREFIX}:`)
  );
}

export function connectedByFromNotifyName(name: string): string | null {
  const n = name.trim();
  const prefix = `${SUPPORT_MAILBOX_NOTIFY_PREFIX}:`;
  if (!n.toLowerCase().startsWith(prefix)) return null;
  const id = n.slice(prefix.length).trim();
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  ) {
    return null;
  }
  return id;
}

export type PlatformUnipileAccount = {
  id: string;
  purpose: "support";
  unipile_account_id: string;
  provider: string;
  status: string;
  display_name: string | null;
  connected_by: string | null;
  last_synced_at: string | null;
};

function mapAccountStatus(raw: Record<string, unknown> | null | undefined): string {
  if (!raw) return "ERROR";
  const sources = raw.sources as Array<{ id?: string; status?: string }> | undefined;
  const mailSource = sources?.find((s) =>
    /mail/i.test(String(s.id || ""))
  );
  const fromSource = mailSource?.status || sources?.[0]?.status;
  if (
    fromSource &&
    ["OK", "CONNECTING", "CREDENTIALS", "STOPPED"].includes(fromSource)
  ) {
    return fromSource;
  }
  const cs = String(raw.connection_status || raw.status || "").toUpperCase();
  if (["OK", "CONNECTING", "CREDENTIALS", "STOPPED"].includes(cs)) return cs;
  return "OK";
}

export async function getSupportMailboxAccount(): Promise<PlatformUnipileAccount | null> {
  const { data, error } = await supabaseAdmin
    .from("platform_unipile_accounts")
    .select(
      "id, purpose, unipile_account_id, provider, status, display_name, connected_by, last_synced_at"
    )
    .eq("purpose", "support")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as PlatformUnipileAccount | null) ?? null;
}

export async function platformAccountForUnipileId(
  unipileAccountId: string | null | undefined
): Promise<PlatformUnipileAccount | null> {
  const id = String(unipileAccountId || "").trim();
  if (!id) return null;
  const { data, error } = await supabaseAdmin
    .from("platform_unipile_accounts")
    .select(
      "id, purpose, unipile_account_id, provider, status, display_name, connected_by, last_synced_at"
    )
    .eq("unipile_account_id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as PlatformUnipileAccount | null) ?? null;
}

/** Unipile account ids owned by the platform (must never be claimed by coaches). */
export async function listPlatformUnipileAccountIds(): Promise<Set<string>> {
  const { data, error } = await supabaseAdmin
    .from("platform_unipile_accounts")
    .select("unipile_account_id");
  if (error) throw new Error(error.message);
  return new Set(
    (data ?? []).map((r) => r.unipile_account_id as string).filter(Boolean)
  );
}

export async function createSupportMailboxConnectLink(
  adminUserId: string,
  request: Request,
  provider: "GOOGLE" | "OUTLOOK" = "GOOGLE",
  reconnectAccountId?: string | null
): Promise<{ url: string }> {
  if (!isUnipileConfigured()) {
    throw new Error("Unipile is not configured (UNIPILE_DSN / UNIPILE_API_KEY).");
  }
  const base = getAppBaseUrl(request);
  const dsn = (process.env.UNIPILE_DSN || "").replace(/\/$/, "");
  const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString();

  const result = await createHostedAuthLink({
    type: reconnectAccountId ? "reconnect" : "create",
    apiUrl: dsn,
    expiresOn: expires,
    providers: [provider],
    name: `${SUPPORT_MAILBOX_NOTIFY_PREFIX}:${adminUserId}`,
    success_redirect_url: `${base}/admin/support?mailbox=connected`,
    failure_redirect_url: `${base}/admin/support?mailbox=failed`,
    notify_url: `${base}/api/unipile/notify`,
    bypass_success_screen: true,
    ...(reconnectAccountId
      ? { reconnect_account: reconnectAccountId }
      : {}),
  });
  if (!result.ok || !result.data?.url) {
    throw new Error(result.error || "Could not create Unipile connect link.");
  }
  return { url: result.data.url };
}

export async function upsertSupportMailboxFromNotify(input: {
  unipileAccountId: string;
  connectedBy?: string | null;
}): Promise<PlatformUnipileAccount> {
  const got = await getUnipileAccount(input.unipileAccountId);
  const raw = (got.data ?? { id: input.unipileAccountId }) as Record<
    string,
    unknown
  >;
  const status = mapAccountStatus(raw);
  const provider = normalizeUnipileProvider(
    String(raw.type || raw.provider || "GOOGLE")
  );
  if (!isMailingProvider(provider) && provider !== "GOOGLE" && provider !== "OUTLOOK") {
    // Still allow — Unipile may report GOOGLE as mailing.
  }

  const display = displayNameFromUnipileAccount(
    raw,
    SUPPORT_MAILBOX_NOTIFY_PREFIX
  );

  const existing = await getSupportMailboxAccount();
  if (
    existing &&
    existing.unipile_account_id !== input.unipileAccountId
  ) {
    // Replacing mailbox: remove old remote account best-effort.
    await deleteUnipileAccount(existing.unipile_account_id).catch(() => null);
  }

  const { data, error } = await supabaseAdmin
    .from("platform_unipile_accounts")
    .upsert(
      {
        purpose: "support",
        unipile_account_id: input.unipileAccountId,
        provider,
        status,
        display_name: display,
        connected_by: input.connectedBy ?? existing?.connected_by ?? null,
        raw,
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "purpose" }
    )
    .select(
      "id, purpose, unipile_account_id, provider, status, display_name, connected_by, last_synced_at"
    )
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Could not save support mailbox.");
  }
  return data as PlatformUnipileAccount;
}

function mailingAddressFromUnipileAccount(
  raw: Record<string, unknown>
): string | null {
  const display = displayNameFromUnipileAccount(raw);
  if (display?.includes("@")) return display.trim().toLowerCase();
  const email = raw.email as
    | string
    | { id?: string; username?: string }
    | undefined;
  if (typeof email === "string" && email.includes("@")) {
    return email.trim().toLowerCase();
  }
  if (email && typeof email === "object") {
    const id = (email.username || email.id || "").trim().toLowerCase();
    if (id.includes("@")) return id;
  }
  const name = String(raw.name || "").trim().toLowerCase();
  if (name.includes("@")) return name;
  return null;
}

/**
 * Persist the support mailbox after hosted-auth when notify_url couldn't reach
 * us (common on localhost). Prefers accounts named platform-support*, then
 * Gmail/Outlook matching support@.
 */
export async function claimSupportMailboxFromUnipile(
  connectedBy?: string | null
): Promise<PlatformUnipileAccount | null> {
  if (!isUnipileConfigured()) {
    throw new Error("Unipile is not configured.");
  }

  const listed = await listUnipileAccounts();
  if (!listed.ok) {
    throw new Error(listed.error || "Could not list Unipile accounts.");
  }

  const supportEmail = BCA_SUPPORT_EMAIL.trim().toLowerCase();
  const items = listed.data?.items ?? [];
  const candidates = items.filter((item) => {
    if (!item?.id) return false;
    const provider = normalizeUnipileProvider(
      String(item.type || item.provider || "")
    );
    if (!isMailingProvider(provider)) return false;
    const name = String(item.name || "");
    if (isSupportMailboxNotifyName(name)) return true;
    const address = mailingAddressFromUnipileAccount(
      item as Record<string, unknown>
    );
    return address === supportEmail;
  });

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    const aName = isSupportMailboxNotifyName(String(a.name || "")) ? 0 : 1;
    const bName = isSupportMailboxNotifyName(String(b.name || "")) ? 0 : 1;
    if (aName !== bName) return aName - bName;
    const aOk = mapAccountStatus(a as Record<string, unknown>) === "OK" ? 0 : 1;
    const bOk = mapAccountStatus(b as Record<string, unknown>) === "OK" ? 0 : 1;
    return aOk - bOk;
  });

  const chosen = candidates[0]!;
  const saved = await upsertSupportMailboxFromNotify({
    unipileAccountId: chosen.id,
    connectedBy,
  });

  // Drop duplicate support@ connections so webhooks don't double-fire —
  // only when the chosen mailbox is healthy.
  if (saved.status === "OK") {
    for (const extra of candidates.slice(1)) {
      if (extra.id === chosen.id) continue;
      await deleteUnipileAccount(extra.id).catch(() => null);
    }
  }

  return saved;
}

export async function disconnectSupportMailbox(): Promise<void> {
  const existing = await getSupportMailboxAccount();
  if (!existing) return;

  const remote = await deleteUnipileAccount(existing.unipile_account_id);
  if (!remote.ok && remote.status !== 404) {
    throw new Error(remote.error || "Could not delete Unipile account.");
  }

  const { error } = await supabaseAdmin
    .from("platform_unipile_accounts")
    .delete()
    .eq("id", existing.id);
  if (error) throw new Error(error.message);
}

export async function updatePlatformAccountStatus(
  unipileAccountId: string,
  status: string
): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("platform_unipile_accounts")
    .update({
      status,
      last_synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("unipile_account_id", unipileAccountId)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return Boolean(data?.id);
}

/** Mark read + move to Archive in the support Gmail/Outlook mailbox. */
export async function tidySupportMailboxEmail(input: {
  emailId: string;
  accountId: string;
}): Promise<void> {
  // Unread=false alone ignores other params per Unipile docs — call twice.
  await updateUnipileEmail(input.emailId, {
    account_id: input.accountId,
    unread: false,
  });
  await updateUnipileEmail(input.emailId, {
    account_id: input.accountId,
    folders: ["archive"],
  });
}

/**
 * True when Unipile says this message is already out of the active inbox
 * (archived, trashed, spam, sent, drafts). Gmail often keeps role=important
 * with only category labels — treat missing INBOX + archive/trash folders
 * as inactive too.
 */
export function isInactiveSupportMailboxEmail(item: {
  role?: unknown;
  folders?: unknown;
}): boolean {
  const role = String(item.role || "").toLowerCase();
  if (
    role === "sent" ||
    role === "drafts" ||
    role === "trash" ||
    role === "archive" ||
    role === "spam"
  ) {
    return true;
  }

  const folders = Array.isArray(item.folders)
    ? item.folders.map((f) => String(f).toLowerCase())
    : [];
  if (
    folders.some(
      (f) =>
        f === "trash" ||
        f === "[gmail]/trash" ||
        f.includes("trash") ||
        f === "archive" ||
        f === "spam" ||
        f === "[gmail]/spam"
    )
  ) {
    return true;
  }

  // Gmail "important" / category-only labels without INBOX → already filed away.
  if (
    (role === "important" || role === "starred" || role === "all") &&
    folders.length > 0 &&
    !folders.some((f) => f === "inbox" || f === "inb")
  ) {
    return true;
  }

  return false;
}

/** Move to Trash so mailbox sync / webhooks will not re-ingest it. */
export async function trashSupportMailboxEmail(input: {
  emailId: string;
  accountId: string;
}): Promise<void> {
  // Prefer Unipile DELETE (moves to Trash). Folder PUT alone often left Gmail
  // messages as role=important without INBOX, which sync still re-ingested.
  const deleted = await deleteUnipileEmail(input.emailId, input.accountId);
  if (deleted.ok) return;

  await updateUnipileEmail(input.emailId, {
    account_id: input.accountId,
    unread: false,
  }).catch(() => null);
  const moved = await updateUnipileEmail(input.emailId, {
    account_id: input.accountId,
    folders: ["trash"],
  });
  if (!moved.ok) {
    throw new Error(
      deleted.error || moved.error || "Could not trash support email."
    );
  }
}

/**
 * Prefer Unipile's email `date` (when it was sent/received) over import time.
 * Returns an ISO string, or null if missing/invalid.
 */
export function parseUnipileEmailDate(
  body: Record<string, unknown> | null | undefined
): string | null {
  if (!body) return null;
  const raw = body.date ?? body.timestamp ?? body.sent_at ?? body.received_at;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    // Unipile sometimes sends unix ms/seconds.
    const ms = raw > 1e12 ? raw : raw * 1000;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  if (typeof raw !== "string" || !raw.trim()) return null;
  const d = new Date(raw.trim());
  if (Number.isNaN(d.getTime())) return null;
  // Reject absurd future dates (clock skew / bad payload).
  if (d.getTime() > Date.now() + 24 * 60 * 60 * 1000) return null;
  return d.toISOString();
}

async function findCoachProfileIdByEmail(
  email: string | null
): Promise<string | null> {
  const normalized = email?.trim().toLowerCase();
  if (!normalized) return null;

  // Same pattern as primaryCoach: Auth email → profiles id.
  const { data, error } = await supabaseAdmin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (error) return null;
  const user = (data.users ?? []).find(
    (u) => (u.email ?? "").trim().toLowerCase() === normalized
  );
  if (!user?.id) return null;

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .in("role", ["coach", "admin"])
    .maybeSingle();
  return (profile?.id as string | null) ?? null;
}

/**
 * Ingest inbound mail for the support mailbox into community_feedback_*.
 * Never writes messaging_*.
 */
export async function handleSupportMailReceived(
  body: Record<string, unknown>
): Promise<string> {
  const accountId = String(body.account_id || "").trim();
  const emailId = String(
    body.email_id || body.id || body.deprecated_id || ""
  ).trim();
  if (!accountId || !emailId) return "missing_ids";

  const account = await platformAccountForUnipileId(accountId);
  if (!account || account.purpose !== "support") return "not_support_account";

  const role = String(body.role || "").toLowerCase();
  const isSent = role === "sent" || String(body.origin || "") === "unipile";
  // Outbound from our mailbox: do not open tickets.
  if (isSent) return "outbound_ignored";
  if (isInactiveSupportMailboxEmail(body)) return "inactive_folder_ignored";

  const { data: existingByEmail } = await supabaseAdmin
    .from("community_feedback_reports")
    .select("id")
    .eq("unipile_email_id", emailId)
    .maybeSingle();
  if (existingByEmail?.id) {
    await tidySupportMailboxEmail({ emailId, accountId }).catch(() => null);
    return "duplicate";
  }

  const from = body.from_attendee as
    | { display_name?: string; identifier?: string }
    | undefined;
  const contactEmail = (from?.identifier || "").trim().toLowerCase() || null;
  if (
    contactEmail?.endsWith(".on.crisp.email") ||
    contactEmail?.includes("@crisp.")
  ) {
    await tidySupportMailboxEmail({ emailId, accountId }).catch(() => null);
    return "crisp_mirror_ignored";
  }
  const submitterName =
    (from?.display_name || from?.identifier || "").trim().slice(0, 120) || null;
  const subject = String(body.subject || "Support email")
    .trim()
    .slice(0, 200);
  const details = stripEmailQuotedReply(
    String(body.body_plain || "").trim() ||
      String(body.body || "").trim() ||
      "(No message body)"
  ).slice(0, 8000);
  const threadId = String(body.thread_id || "").trim() || null;
  const emailDate = parseUnipileEmailDate(body);

  const appendReplyToTicket = async (
    ticket: { id: string; status: string | null },
    options?: { linkThreadId?: string | null }
  ): Promise<"thread_reply"> => {
    const coachId = await findCoachProfileIdByEmail(contactEmail);
    const replyAuthor =
      coachId || (await findSystemReplyAuthor(account.connected_by));

    if (replyAuthor) {
      await supabaseAdmin.from("community_feedback_replies").insert({
        report_id: ticket.id,
        created_by: replyAuthor,
        body: details,
        ...(emailDate ? { created_at: emailDate } : {}),
      });
    }

    void maybeFillProfilePhoneFromEmailBody(coachId, details).catch(() => null);

    const patch: Record<string, unknown> = {};
    if (ticket.status === "resolved" || ticket.status === "waiting_reply") {
      patch.status = "open";
    }
    if (options?.linkThreadId) {
      patch.unipile_thread_id = options.linkThreadId;
      patch.unipile_account_id = accountId;
    }
    if (Object.keys(patch).length) {
      await supabaseAdmin
        .from("community_feedback_reports")
        .update(patch)
        .eq("id", ticket.id);
    }

    await tidySupportMailboxEmail({ emailId, accountId }).catch(() => null);
    return "thread_reply";
  };

  // Follow-up in an existing email thread → append reply
  if (threadId) {
    const { data: threadTicket } = await supabaseAdmin
      .from("community_feedback_reports")
      .select("id, status")
      .eq("unipile_thread_id", threadId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (threadTicket?.id) {
      return appendReplyToTicket(threadTicket);
    }
  }

  // Reply to a Bird notify (or any mail) that still carries SUP-#### in the subject
  const ticketNumber = parseSupportTicketNumberFromSubject(subject);
  if (ticketNumber) {
    const { data: numberedTicket } = await supabaseAdmin
      .from("community_feedback_reports")
      .select("id, status, unipile_thread_id")
      .eq("ticket_number", ticketNumber)
      .maybeSingle();
    if (numberedTicket?.id) {
      return appendReplyToTicket(numberedTicket, {
        linkThreadId: numberedTicket.unipile_thread_id ? null : threadId,
      });
    }
    // Ticket was deleted — do not spawn "Re: SUP-#### …" zombie tickets.
    await trashSupportMailboxEmail({ emailId, accountId }).catch(() => null);
    return "orphaned_ticket_reply";
  }

  const createdBy = await findCoachProfileIdByEmail(contactEmail);

  const { error } = await supabaseAdmin.from("community_feedback_reports").insert({
    created_by: createdBy,
    type: "question",
    title: subject,
    details,
    contact_email: contactEmail,
    submitter_name: submitterName,
    page_path: null,
    source: "email_inbox",
    assigned_to: DEFAULT_SUPPORT_ASSIGNEE_ID,
    status: "open",
    unipile_email_id: emailId,
    unipile_thread_id: threadId,
    unipile_account_id: accountId,
    ...(emailDate ? { created_at: emailDate } : {}),
  });

  if (error) {
    if (error.code === "23505") return "duplicate";
    console.error("support mail ingest:", error.message);
    return "insert_failed";
  }

  void maybeFillProfilePhoneFromEmailBody(createdBy, details).catch(() => null);

  if (contactEmail && shouldAutoAckSupportEmail(contactEmail)) {
    void sendSupportEmailReceiptAck({
      accountId,
      toEmail: contactEmail,
      toName: submitterName,
      subject,
      replyToEmailId: emailId,
    }).catch((err) => {
      console.warn("support receipt ack:", err);
    });
  }

  await tidySupportMailboxEmail({ emailId, accountId }).catch((err) => {
    console.warn("support mail tidy:", err);
  });

  return "ticket_created";
}

async function findSystemReplyAuthor(
  connectedBy: string | null
): Promise<string | null> {
  if (connectedBy) return connectedBy;
  return DEFAULT_SUPPORT_ASSIGNEE_ID;
}

async function supportMailboxIdsForTicket(
  ticketId: string
): Promise<{ emailId: string; accountId: string } | null> {
  const { data } = await supabaseAdmin
    .from("community_feedback_reports")
    .select("unipile_email_id, unipile_account_id")
    .eq("id", ticketId)
    .maybeSingle();
  const emailId = data?.unipile_email_id as string | null;
  const accountId = data?.unipile_account_id as string | null;
  if (!emailId || !accountId) return null;
  return { emailId, accountId };
}

/** When a ticket is resolved, archive its source email if linked. */
export async function tidySupportEmailForTicket(ticketId: string): Promise<void> {
  const ids = await supportMailboxIdsForTicket(ticketId);
  if (!ids) return;
  await tidySupportMailboxEmail(ids);
}

/** When a ticket is deleted, trash its source email so sync won't recreate it. */
export async function trashSupportEmailForTicket(ticketId: string): Promise<void> {
  const ids = await supportMailboxIdsForTicket(ticketId);
  if (!ids) return;
  await trashSupportMailboxEmail(ids);
}

/**
 * Poll the support mailbox for recent inbound mail and ingest tickets.
 * Needed when Unipile webhooks can't reach localhost (local APP_BASE_URL),
 * and as a safety net in production.
 */
export async function syncSupportMailboxInbound(limit = 25): Promise<{
  scanned: number;
  created: number;
  replies: number;
  skipped: number;
  errors: string[];
}> {
  const mailbox = await getSupportMailboxAccount();
  if (!mailbox) {
    return {
      scanned: 0,
      created: 0,
      replies: 0,
      skipped: 0,
      errors: ["Support mailbox is not connected."],
    };
  }

  const listed = await listUnipileEmails({
    account_id: mailbox.unipile_account_id,
    limit,
    meta_only: true,
  });
  if (!listed.ok) {
    return {
      scanned: 0,
      created: 0,
      replies: 0,
      skipped: 0,
      errors: [listed.error || "Could not list support emails."],
    };
  }

  const supportEmail = BCA_SUPPORT_EMAIL.trim().toLowerCase();
  let created = 0;
  let replies = 0;
  let skipped = 0;
  const errors: string[] = [];
  const items = listed.data?.items ?? [];

  for (const item of items) {
    const emailId = String(item.id || "").trim();
    if (!emailId) {
      skipped += 1;
      continue;
    }

    if (isInactiveSupportMailboxEmail(item)) {
      skipped += 1;
      continue;
    }

    const from = mailingAddressFromUnipileAccount(
      item as Record<string, unknown>
    );
    // Prefer from_attendee when present on list payloads.
    const fromAttendee = (item as { from_attendee?: { identifier?: string } })
      .from_attendee?.identifier?.trim()
      .toLowerCase();
    const fromEmail = fromAttendee || from;
    if (fromEmail === supportEmail) {
      skipped += 1;
      continue;
    }
    // Crisp also monitors support@ and writes mirror messages into the same
    // mailbox — skip those so we don't double-create tickets.
    if (fromEmail?.endsWith(".on.crisp.email") || fromEmail?.includes("@crisp.")) {
      skipped += 1;
      continue;
    }

    const full = await getUnipileEmail(emailId, mailbox.unipile_account_id);
    if (!full.ok || !full.data) {
      errors.push(`${emailId}: ${full.error || "fetch failed"}`);
      continue;
    }

    const raw = full.raw as Record<string, unknown> | undefined;
    const body: Record<string, unknown> = {
      ...(raw && typeof raw === "object" ? raw : {}),
      account_id: mailbox.unipile_account_id,
      email_id: emailId,
      id: emailId,
    };

    try {
      const detail = await handleSupportMailReceived(body);
      if (detail === "ticket_created") created += 1;
      else if (detail === "thread_reply") replies += 1;
      else skipped += 1;
    } catch (err) {
      errors.push(
        `${emailId}: ${err instanceof Error ? err.message : "ingest failed"}`
      );
    }
  }

  return {
    scanned: items.length,
    created,
    replies,
    skipped,
    errors,
  };
}

/**
 * Correct `created_at` on email-inbox tickets that were stamped at import
 * time instead of the Unipile email date.
 */
export async function backfillSupportTicketEmailDates(limit = 100): Promise<{
  checked: number;
  updated: number;
  errors: string[];
}> {
  const { data: tickets, error } = await supabaseAdmin
    .from("community_feedback_reports")
    .select("id, created_at, unipile_email_id, unipile_account_id, title, submitter_name")
    .eq("source", "email_inbox")
    .not("unipile_email_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return { checked: 0, updated: 0, errors: [error.message] };
  }

  let updated = 0;
  const errors: string[] = [];
  const rows = tickets ?? [];

  for (const ticket of rows) {
    const emailId = String(ticket.unipile_email_id || "").trim();
    const accountId = String(ticket.unipile_account_id || "").trim() || null;
    if (!emailId) continue;

    const full = await getUnipileEmail(emailId, accountId);
    if (!full.ok || !full.data) {
      errors.push(
        `${ticket.id}: ${full.error || "could not fetch Unipile email"}`
      );
      continue;
    }

    const raw = (full.raw ?? full.data) as Record<string, unknown>;
    const emailDate = parseUnipileEmailDate(raw);
    if (!emailDate) {
      errors.push(`${ticket.id}: Unipile email missing date`);
      continue;
    }

    const current = new Date(String(ticket.created_at || "")).getTime();
    const next = new Date(emailDate).getTime();
    // Only rewrite when off by more than a minute (avoid churn).
    if (
      Number.isFinite(current) &&
      Number.isFinite(next) &&
      Math.abs(current - next) < 60_000
    ) {
      continue;
    }

    const { error: upErr } = await supabaseAdmin
      .from("community_feedback_reports")
      .update({ created_at: emailDate })
      .eq("id", ticket.id);

    if (upErr) {
      errors.push(`${ticket.id}: ${upErr.message}`);
      continue;
    }
    updated += 1;
  }

  return { checked: rows.length, updated, errors };
}
