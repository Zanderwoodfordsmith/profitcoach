/**
 * Zander's and Pam's own WhatsApp in Support (18 Nov 2026).
 *
 * Each BCA admin can link their own WhatsApp. The one hard rule: a chat is
 * only read when it is one-to-one with a number that matches exactly one
 * coach's profile phone. Everything else (family, friends, prospects, groups,
 * each other) is skipped before anything is stored.
 *
 * Coach messages land in that coach's Support chat: the chat BCA last sent a
 * WhatsApp from (within a week), else the coach's "WhatsApp" chat.
 */
import { phoneMatchKey } from "@/lib/messaging/knownContacts";
import {
  isUnipileReactionEvent,
  parseUnipileMessageFlags,
} from "@/lib/messaging/messageReactions";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { DEFAULT_SUPPORT_ASSIGNEE_ID } from "@/lib/support/assignees";
import {
  createHostedAuthLink,
  deleteUnipileAccount,
  getUnipileAccount,
  getUnipileDsn,
  isUnipileConfigured,
  listUnipileAccounts,
  listUnipileChatMessages,
  listUnipileChats,
  sendUnipileChatMessage,
  startUnipileChat,
  unipileFetch,
} from "@/lib/unipile/client";
import { phoneDigitsFromWhatsAppJid } from "@/lib/unipile/whatsappIdentity";

export const SUPPORT_WHATSAPP_NOTIFY_PREFIX = "support-whatsapp";

/** A coach reply within this long of BCA's last WhatsApp goes to that chat. */
const FOLLOW_LAST_SENT_MS = 7 * 24 * 60 * 60 * 1000;
/** First import after linking: this many days back. */
export const SUPPORT_WHATSAPP_HISTORY_DAYS = 14;
/** Imported chats whose last message is older than this start as Done. */
const IMPORT_QUIET_MS = 3 * 24 * 60 * 60 * 1000;

export type SupportWhatsAppLine = {
  id: string;
  admin_id: string;
  unipile_account_id: string;
  phone: string | null;
  status: string;
  display_name: string | null;
  last_synced_at: string | null;
};

const LINE_SELECT =
  "id, admin_id, unipile_account_id, phone, status, display_name, last_synced_at";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isSupportWhatsAppNotifyName(name: string): boolean {
  return name.trim().toLowerCase().startsWith(`${SUPPORT_WHATSAPP_NOTIFY_PREFIX}:`);
}

export function adminIdFromSupportWhatsAppNotifyName(name: string): string | null {
  const id = name.trim().slice(SUPPORT_WHATSAPP_NOTIFY_PREFIX.length + 1).trim();
  return UUID.test(id) ? id : null;
}

// ---------------------------------------------------------------------------
// Lines (one per admin)
// ---------------------------------------------------------------------------

export async function listSupportWhatsAppLines(): Promise<SupportWhatsAppLine[]> {
  const { data, error } = await supabaseAdmin
    .from("support_whatsapp_lines")
    .select(LINE_SELECT);
  if (error) throw new Error(error.message);
  return (data ?? []) as SupportWhatsAppLine[];
}

export async function supportWhatsAppLineForAdmin(
  adminId: string
): Promise<SupportWhatsAppLine | null> {
  const { data, error } = await supabaseAdmin
    .from("support_whatsapp_lines")
    .select(LINE_SELECT)
    .eq("admin_id", adminId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as SupportWhatsAppLine | null) ?? null;
}

export async function supportWhatsAppLineForUnipileAccount(
  unipileAccountId: string | null | undefined
): Promise<SupportWhatsAppLine | null> {
  const id = String(unipileAccountId || "").trim();
  if (!id) return null;
  const { data, error } = await supabaseAdmin
    .from("support_whatsapp_lines")
    .select(LINE_SELECT)
    .eq("unipile_account_id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as SupportWhatsAppLine | null) ?? null;
}

function accountStatus(raw: Record<string, unknown> | null | undefined): string {
  const sources = raw?.sources as Array<{ status?: string }> | undefined;
  const s = String(sources?.[0]?.status || raw?.status || "OK").toUpperCase();
  return ["OK", "CONNECTING", "CREDENTIALS", "STOPPED", "ERROR"].includes(s) ? s : "OK";
}

function phoneOfAccount(raw: Record<string, unknown>): string | null {
  const params = raw.connection_params as { im?: { phone_number?: string } } | undefined;
  return (
    phoneMatchKey(params?.im?.phone_number ?? null) ||
    phoneMatchKey(typeof raw.name === "string" ? raw.name : null)
  );
}

export async function createSupportWhatsAppConnectLink(
  adminId: string,
  appBase: string
): Promise<{ url: string }> {
  if (!isUnipileConfigured()) throw new Error("Unipile is not configured.");
  const existing = await supportWhatsAppLineForAdmin(adminId);
  const result = await createHostedAuthLink({
    type: existing ? "reconnect" : "create",
    apiUrl: getUnipileDsn(),
    expiresOn: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    providers: ["WHATSAPP"],
    name: `${SUPPORT_WHATSAPP_NOTIFY_PREFIX}:${adminId}`,
    success_redirect_url: `${appBase}/admin/support?whatsapp=connected`,
    failure_redirect_url: `${appBase}/admin/support?whatsapp=failed`,
    notify_url: `${appBase}/api/unipile/notify`,
    bypass_success_screen: true,
    ...(existing ? { reconnect_account: existing.unipile_account_id } : {}),
  });
  if (!result.ok || !result.data?.url) {
    throw new Error(result.error || "Could not create a WhatsApp connect link.");
  }
  return { url: result.data.url };
}

export async function upsertSupportWhatsAppLine(input: {
  unipileAccountId: string;
  adminId: string;
}): Promise<SupportWhatsAppLine> {
  const got = await getUnipileAccount(input.unipileAccountId);
  const raw = (got.data ?? { id: input.unipileAccountId }) as Record<string, unknown>;
  const existing = await supportWhatsAppLineForAdmin(input.adminId);
  if (existing && existing.unipile_account_id !== input.unipileAccountId) {
    await deleteUnipileAccount(existing.unipile_account_id).catch(() => null);
  }
  const { data, error } = await supabaseAdmin
    .from("support_whatsapp_lines")
    .upsert(
      {
        admin_id: input.adminId,
        unipile_account_id: input.unipileAccountId,
        phone: phoneOfAccount(raw),
        status: accountStatus(got.ok ? raw : null),
        display_name: typeof raw.name === "string" ? raw.name : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "admin_id" }
    )
    .select(LINE_SELECT)
    .single();
  if (error || !data) throw new Error(error?.message ?? "Could not save the WhatsApp line.");
  return data as SupportWhatsAppLine;
}

/**
 * Localhost: Unipile cannot reach notify_url, so after the redirect we claim
 * the WhatsApp account this admin just linked (newest, made in the last
 * 30 minutes, not owned by a coach or another line).
 */
export async function claimSupportWhatsAppFromUnipile(
  adminId: string
): Promise<SupportWhatsAppLine | null> {
  const listed = await listUnipileAccounts();
  if (!listed.ok) throw new Error(listed.error || "Could not list Unipile accounts.");
  const [{ data: coachRows }, { data: platformRows }, { data: lineRows }] = await Promise.all([
    supabaseAdmin.from("linkedin_outreach_accounts").select("unipile_account_id"),
    supabaseAdmin.from("platform_unipile_accounts").select("unipile_account_id"),
    supabaseAdmin.from("support_whatsapp_lines").select("unipile_account_id"),
  ]);
  const taken = new Set(
    [...(coachRows ?? []), ...(platformRows ?? []), ...(lineRows ?? [])].map(
      (r) => r.unipile_account_id as string
    )
  );
  const cutoff = Date.now() - 30 * 60 * 1000;
  const fresh = (listed.data?.items ?? [])
    .filter((item) => {
      const rec = item as unknown as Record<string, unknown>;
      if (!item?.id || taken.has(item.id)) return false;
      if (String(rec.type || "").toUpperCase() !== "WHATSAPP") return false;
      const created = Date.parse(String(rec.created_at || ""));
      return Number.isFinite(created) && created >= cutoff;
    })
    .sort(
      (a, b) =>
        Date.parse(String((b as unknown as Record<string, unknown>).created_at)) -
        Date.parse(String((a as unknown as Record<string, unknown>).created_at))
    );
  const chosen = fresh[0];
  if (!chosen) return null;
  return upsertSupportWhatsAppLine({ unipileAccountId: chosen.id, adminId });
}

export async function refreshSupportWhatsAppLineStatus(
  line: SupportWhatsAppLine
): Promise<SupportWhatsAppLine> {
  const got = await getUnipileAccount(line.unipile_account_id);
  const status = got.ok
    ? accountStatus(got.data as unknown as Record<string, unknown>)
    : got.status === 404
      ? "ERROR"
      : line.status;
  if (status === line.status) return line;
  await supabaseAdmin
    .from("support_whatsapp_lines")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", line.id);
  return { ...line, status };
}

export async function disconnectSupportWhatsApp(adminId: string): Promise<void> {
  const line = await supportWhatsAppLineForAdmin(adminId);
  if (!line) return;
  const remote = await deleteUnipileAccount(line.unipile_account_id);
  if (!remote.ok && remote.status !== 404) {
    throw new Error(remote.error || "Could not unlink WhatsApp.");
  }
  const { error } = await supabaseAdmin
    .from("support_whatsapp_lines")
    .delete()
    .eq("id", line.id);
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// The one rule: only a coach's number, one-to-one
// ---------------------------------------------------------------------------

type CoachIndex = {
  /** phone key → coach id, only numbers that belong to exactly one coach. */
  byPhone: Map<string, string>;
  /** BCA's own linked numbers: never a coach chat (e.g. Zander ↔ Pam). */
  linePhones: Set<string>;
};

export async function loadCoachPhoneIndex(): Promise<CoachIndex> {
  const counts = new Map<string, string[]>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("id, phone")
      .eq("role", "coach")
      .not("phone", "is", null)
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      const key = phoneMatchKey(row.phone as string | null);
      if (!key) continue;
      counts.set(key, [...(counts.get(key) ?? []), row.id as string]);
    }
    if (!data || data.length < 1000) break;
  }
  const lines = await listSupportWhatsAppLines();
  const linePhones = new Set(lines.map((l) => l.phone).filter((p): p is string => Boolean(p)));
  const byPhone = new Map<string, string>();
  for (const [key, ids] of counts) {
    if (ids.length === 1 && !linePhones.has(key)) byPhone.set(key, ids[0]!);
  }
  return { byPhone, linePhones };
}

/** The coach a Unipile chat is with, or null (group, unknown, BCA's own number). */
export function coachIdForChat(
  chat: Record<string, unknown>,
  index: CoachIndex
): string | null {
  if (Number(chat.type) !== 0) return null; // 1 and 2 are groups
  const candidates = [
    chat.attendee_public_identifier,
    chat.provider_id,
    chat.attendee_provider_id,
  ].map((v) => (typeof v === "string" ? v : ""));
  if (candidates.some((v) => v.toLowerCase().includes("@g.us"))) return null;
  let digits: string | null = null;
  for (const c of candidates) {
    digits = phoneDigitsFromWhatsAppJid(c);
    if (digits) break;
  }
  if (!digits || index.linePhones.has(digits)) return null;
  return index.byPhone.get(digits) ?? null;
}

// ---------------------------------------------------------------------------
// Bringing messages in
// ---------------------------------------------------------------------------

type IncomingMessage = {
  id: string;
  text: string;
  isSender: boolean;
  createdAt: string;
  hasFiles: boolean;
};

function messageFromUnipile(raw: Record<string, unknown>): IncomingMessage | null {
  const id = String(raw.id || raw.message_id || "").trim();
  if (!id) return null;
  const flags = parseUnipileMessageFlags(raw);
  if (isUnipileReactionEvent(flags) || flags.isEvent || flags.hidden) return null;
  const attachments = Array.isArray(raw.attachments) ? raw.attachments : [];
  if (!flags.text && attachments.length === 0) return null;
  const stamp = String(raw.timestamp || raw.date || "").trim();
  const parsed = stamp ? Date.parse(stamp) : NaN;
  return {
    id,
    text: flags.text,
    isSender: Boolean(raw.is_sender),
    createdAt: Number.isFinite(parsed) ? new Date(parsed).toISOString() : new Date().toISOString(),
    hasFiles: attachments.length > 0,
  };
}

function bodyOf(msg: IncomingMessage): string {
  const note = "(Sent a photo or file on WhatsApp. Open WhatsApp to see it.)";
  if (!msg.text) return note;
  return msg.hasFiles ? `${msg.text}\n\n${note}` : msg.text;
}

const firstNames = new Map<string, string>();
async function firstNameOf(profileId: string): Promise<string> {
  const cached = firstNames.get(profileId);
  if (cached) return cached;
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("full_name")
    .eq("id", profileId)
    .maybeSingle();
  const name = String(data?.full_name || "").trim().split(/\s+/)[0] || "BCA";
  firstNames.set(profileId, name);
  return name;
}

/** Which Support chat a new WhatsApp message from or to this coach belongs in. */
async function reportForMessage(input: {
  coachId: string;
}): Promise<string | null> {
  const { data: chatRows } = await supabaseAdmin
    .from("support_whatsapp_chats")
    .select("last_report_id, last_sent_at")
    .eq("coach_id", input.coachId)
    .not("last_report_id", "is", null)
    .order("last_sent_at", { ascending: false, nullsFirst: false })
    .limit(1);
  const last = chatRows?.[0];
  if (
    last?.last_report_id &&
    last.last_sent_at &&
    Date.now() - Date.parse(String(last.last_sent_at)) < FOLLOW_LAST_SENT_MS
  ) {
    return last.last_report_id as string;
  }
  const { data: waReport } = await supabaseAdmin
    .from("community_feedback_reports")
    .select("id")
    .eq("created_by", input.coachId)
    .eq("source", "whatsapp")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (waReport?.id as string | undefined) ?? null;
}

async function rememberChat(input: {
  line: SupportWhatsAppLine;
  coachId: string;
  chatId: string;
  reportId?: string | null;
  sentAt?: string | null;
}) {
  const patch: Record<string, unknown> = {
    line_id: input.line.id,
    coach_id: input.coachId,
    unipile_chat_id: input.chatId,
  };
  if (input.reportId) patch.last_report_id = input.reportId;
  if (input.sentAt) patch.last_sent_at = input.sentAt;
  await supabaseAdmin
    .from("support_whatsapp_chats")
    .upsert(patch, { onConflict: "line_id,coach_id" });
}

/**
 * Store one WhatsApp message in the coach's Support chat. Returns what
 * happened, for logs. Callers must have matched the chat to a coach first.
 */
async function ingestCoachMessage(input: {
  line: SupportWhatsAppLine;
  coachId: string;
  chatId: string;
  msg: IncomingMessage;
}): Promise<string> {
  const { line, coachId, chatId, msg } = input;

  const [{ data: seenReply }, { data: seenReport }] = await Promise.all([
    supabaseAdmin
      .from("community_feedback_replies")
      .select("id")
      .eq("whatsapp_message_id", msg.id)
      .maybeSingle(),
    supabaseAdmin
      .from("community_feedback_reports")
      .select("id")
      .eq("whatsapp_message_id", msg.id)
      .maybeSingle(),
  ]);
  if (seenReply?.id || seenReport?.id) return "duplicate";

  // BCA's own message sent from the app comes back as an echo: link it, don't copy it.
  if (msg.isSender) {
    const since = new Date(Date.parse(msg.createdAt) - 15 * 60 * 1000).toISOString();
    const { data: sentFromApp } = await supabaseAdmin
      .from("community_feedback_replies")
      .select("id, body, whatsapp_message_id, report:community_feedback_reports!inner(created_by)")
      .eq("via_whatsapp", true)
      .eq("report.created_by", coachId)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(5);
    const echo = (sentFromApp ?? []).find(
      (r) => String(r.body || "").trim() === msg.text.trim()
    );
    if (echo) {
      if (!echo.whatsapp_message_id) {
        await supabaseAdmin
          .from("community_feedback_replies")
          .update({ whatsapp_message_id: msg.id })
          .eq("id", echo.id);
      }
      return "echo_linked";
    }
  }

  const authorId = msg.isSender ? line.admin_id : coachId;
  const withName = await firstNameOf(line.admin_id);
  let reportId = await reportForMessage({ coachId });

  if (!reportId) {
    const { data: created, error } = await supabaseAdmin
      .from("community_feedback_reports")
      .insert({
        created_by: coachId,
        created_by_admin: msg.isSender ? line.admin_id : null,
        source: "whatsapp",
        assigned_to: DEFAULT_SUPPORT_ASSIGNEE_ID,
        type: "question",
        title: "WhatsApp",
        details: bodyOf(msg),
        status: msg.isSender ? "waiting_reply" : "open",
        whatsapp_message_id: msg.id,
        coach_last_read_at: msg.createdAt,
        created_at: msg.createdAt,
      })
      .select("id")
      .single();
    if (error) {
      if (error.code === "23505") return "duplicate";
      throw new Error(error.message);
    }
    reportId = created.id as string;
    await rememberChat({ line, coachId, chatId });
    return "chat_started";
  }

  const { error } = await supabaseAdmin.from("community_feedback_replies").insert({
    report_id: reportId,
    created_by: authorId,
    body: bodyOf(msg),
    via_whatsapp: true,
    whatsapp_message_id: msg.id,
    whatsapp_with: withName,
    created_at: msg.createdAt,
  });
  if (error) {
    if (error.code === "23505") return "duplicate";
    throw new Error(error.message);
  }
  // The coach has seen this on WhatsApp already: no unread badge in the app.
  const { data: readRow } = await supabaseAdmin
    .from("community_feedback_reports")
    .select("coach_last_read_at")
    .eq("id", reportId)
    .maybeSingle();
  const readAt = String(readRow?.coach_last_read_at || "");
  if (!readAt || Date.parse(readAt) < Date.parse(msg.createdAt)) {
    await supabaseAdmin
      .from("community_feedback_reports")
      .update({ coach_last_read_at: msg.createdAt })
      .eq("id", reportId);
  }
  await rememberChat({ line, coachId, chatId });
  return "reply_added";
}

async function getUnipileChat(chatId: string) {
  return unipileFetch<Record<string, unknown>>(
    "GET",
    `/api/v1/chats/${encodeURIComponent(chatId)}`
  );
}

/** Webhook: one message on a linked BCA WhatsApp. */
export async function handleSupportWhatsAppWebhook(
  line: SupportWhatsAppLine,
  body: Record<string, unknown>
): Promise<string> {
  const chatId = String(body.chat_id || "").trim();
  if (!chatId) return "missing_chat";

  const { data: known } = await supabaseAdmin
    .from("support_whatsapp_chats")
    .select("coach_id")
    .eq("line_id", line.id)
    .eq("unipile_chat_id", chatId)
    .maybeSingle();
  let coachId = (known?.coach_id as string | undefined) ?? null;
  if (!coachId) {
    const chat = await getUnipileChat(chatId);
    if (!chat.ok || !chat.data) return "chat_lookup_failed";
    coachId = coachIdForChat(chat.data, await loadCoachPhoneIndex());
  }
  if (!coachId) return "not_a_coach"; // personal chat: nothing stored

  const msg = messageFromUnipile({
    ...body,
    id: body.message_id || body.id,
    text: body.message || body.text,
  });
  if (!msg) return "skipped";
  return ingestCoachMessage({ line, coachId, chatId, msg });
}

/**
 * Poll a line for coach chats active since `sinceIso` (localhost has no
 * webhooks; the first run after linking brings in recent history).
 */
export async function syncSupportWhatsAppLine(
  line: SupportWhatsAppLine,
  opts: { sinceIso: string; deadlineAt?: number }
): Promise<{ chats: number; messages: number }> {
  const index = await loadCoachPhoneIndex();
  const firstImport = !line.last_synced_at;
  const startedAt = new Date().toISOString();
  let cursor: string | null = null;
  let chats = 0;
  let messages = 0;
  const touchedReports = new Set<string>();

  for (let page = 0; page < 10; page += 1) {
    if (opts.deadlineAt && Date.now() > opts.deadlineAt) break;
    const listed = await listUnipileChats({
      account_id: line.unipile_account_id,
      limit: 100,
      cursor,
      after: opts.sinceIso,
    });
    if (!listed.ok) break;
    for (const chat of listed.data?.items ?? []) {
      const coachId = coachIdForChat(chat, index);
      if (!coachId) continue; // personal chat: never read its messages
      const chatId = String(chat.id || "").trim();
      if (!chatId) continue;
      chats += 1;
      const pulled = await listUnipileChatMessages({ chat_id: chatId, limit: 50 });
      if (!pulled.ok) continue;
      const items = (pulled.data?.items ?? [])
        .map((m) => messageFromUnipile(m))
        .filter((m): m is IncomingMessage => Boolean(m))
        .filter((m) => m.createdAt >= opts.sinceIso)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      for (const msg of items) {
        const result = await ingestCoachMessage({ line, coachId, chatId, msg });
        if (result === "reply_added" || result === "chat_started") messages += 1;
      }
      if (firstImport && items.length) {
        const reportId = await reportForMessage({ coachId });
        if (reportId) touchedReports.add(reportId);
      }
    }
    cursor = listed.data?.cursor ?? null;
    if (!cursor) break;
  }

  // History, not new work: chats gone quiet for 3+ days start as Done.
  for (const reportId of touchedReports) {
    const { data: latest } = await supabaseAdmin
      .from("community_feedback_replies")
      .select("created_at")
      .eq("report_id", reportId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const { data: report } = await supabaseAdmin
      .from("community_feedback_reports")
      .select("created_at")
      .eq("id", reportId)
      .maybeSingle();
    const lastAt = String(latest?.created_at || report?.created_at || "");
    if (lastAt && Date.now() - Date.parse(lastAt) > IMPORT_QUIET_MS) {
      await supabaseAdmin
        .from("community_feedback_reports")
        .update({ status: "resolved" })
        .eq("id", reportId)
        .eq("source", "whatsapp");
    }
  }

  await supabaseAdmin
    .from("support_whatsapp_lines")
    .update({ last_synced_at: startedAt })
    .eq("id", line.id);
  return { chats, messages };
}

// ---------------------------------------------------------------------------
// Sending from the app
// ---------------------------------------------------------------------------

export type SupportWhatsAppRoute =
  | { ok: true; line: SupportWhatsAppLine; fromName: string; to: string; coachId: string }
  | { ok: false; reason: string };

/** Which phone a WhatsApp reply on this ticket would go from, and to. */
export async function supportWhatsAppRoute(input: {
  reportId: string;
  adminId: string;
}): Promise<SupportWhatsAppRoute> {
  const { data: report } = await supabaseAdmin
    .from("community_feedback_reports")
    .select("created_by")
    .eq("id", input.reportId)
    .maybeSingle();
  const coachId = (report?.created_by as string | null) ?? null;
  if (!coachId) return { ok: false, reason: "This chat has no coach." };
  const { data: coach } = await supabaseAdmin
    .from("profiles")
    .select("phone, role")
    .eq("id", coachId)
    .maybeSingle();
  const to = phoneMatchKey((coach?.phone as string | null) ?? null);
  if (!to) return { ok: false, reason: "No phone number on this coach's profile." };

  const lines = (await listSupportWhatsAppLines()).filter((l) => l.status === "OK");
  if (!lines.length) return { ok: false, reason: "Link your WhatsApp first (Support → Inbox)." };
  if (lines.some((l) => l.phone === to)) {
    return { ok: false, reason: "That number is one of BCA's own." };
  }
  // Your own phone first; else the phone this coach last talked to.
  let line = lines.find((l) => l.admin_id === input.adminId) ?? null;
  if (!line) {
    const { data: chats } = await supabaseAdmin
      .from("support_whatsapp_chats")
      .select("line_id, last_sent_at, created_at")
      .eq("coach_id", coachId)
      .order("last_sent_at", { ascending: false, nullsFirst: false });
    const lineId = chats?.find((c) => lines.some((l) => l.id === c.line_id))?.line_id;
    line = lines.find((l) => l.id === lineId) ?? lines[0]!;
  }
  return { ok: true, line, fromName: await firstNameOf(line.admin_id), to, coachId };
}

async function filesForMedia(media: unknown): Promise<Array<{ blob: Blob; filename: string }>> {
  const items = Array.isArray(media) ? media.slice(0, 5) : [];
  const files: Array<{ blob: Blob; filename: string }> = [];
  for (const item of items) {
    const url = typeof item?.url === "string" ? item.url : "";
    if (!url) continue;
    const res = await fetch(url).catch(() => null);
    if (!res?.ok) continue;
    const blob = await res.blob();
    const fromUrl = decodeURIComponent(url.split("?")[0]!.split("/").pop() || "file");
    files.push({ blob, filename: (typeof item.name === "string" && item.name) || fromUrl });
  }
  return files;
}

/** Send a saved Support reply to the coach on WhatsApp and mark it. */
export async function sendSupportReplyOnWhatsApp(input: {
  replyId: string;
  adminId: string;
}): Promise<{ ok: true; fromName: string } | { ok: false; error: string }> {
  const { data: reply } = await supabaseAdmin
    .from("community_feedback_replies")
    .select("id, report_id, created_by, body, media, via_whatsapp")
    .eq("id", input.replyId)
    .maybeSingle();
  if (!reply) return { ok: false, error: "Reply not found." };
  if (reply.via_whatsapp) return { ok: true, fromName: "" };

  // "Send as" Pam goes from Pam's phone when she has linked one.
  const route = await supportWhatsAppRoute({
    reportId: reply.report_id as string,
    adminId: (reply.created_by as string | null) || input.adminId,
  });
  if (!route.ok) return { ok: false, error: route.reason };
  const { line, coachId, to } = route;

  const text = String(reply.body || "").trim();
  const attachments = await filesForMedia(reply.media);

  const { data: chatRow } = await supabaseAdmin
    .from("support_whatsapp_chats")
    .select("unipile_chat_id")
    .eq("line_id", line.id)
    .eq("coach_id", coachId)
    .maybeSingle();

  let chatId = (chatRow?.unipile_chat_id as string | undefined) ?? null;
  let messageId: string | null = null;
  if (chatId) {
    const sent = await sendUnipileChatMessage({
      chat_id: chatId,
      account_id: line.unipile_account_id,
      text,
      attachments: attachments.length ? attachments : undefined,
    });
    if (!sent.ok) return { ok: false, error: sent.error || "WhatsApp did not send." };
    messageId = sent.data?.message_id ?? null;
  } else {
    const started = await startUnipileChat({
      account_id: line.unipile_account_id,
      attendees_ids: [`${to}@s.whatsapp.net`],
      text,
    });
    if (!started.ok || !started.data?.chat_id) {
      return { ok: false, error: started.error || "WhatsApp did not send." };
    }
    chatId = started.data.chat_id;
    messageId = started.data.message_id ?? null;
    if (attachments.length) {
      await sendUnipileChatMessage({
        chat_id: chatId,
        account_id: line.unipile_account_id,
        attachments,
      }).catch(() => null);
    }
  }

  const now = new Date().toISOString();
  await supabaseAdmin
    .from("community_feedback_replies")
    .update({
      via_whatsapp: true,
      whatsapp_with: route.fromName,
      ...(messageId ? { whatsapp_message_id: messageId } : {}),
    })
    .eq("id", reply.id);
  await rememberChat({
    line,
    coachId,
    chatId,
    reportId: reply.report_id as string,
    sentAt: now,
  });
  return { ok: true, fromName: route.fromName };
}
