import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * Safety net so campaign leads match what really happened in LinkedIn.
 * Replies can slip past the live paths: a chat that starts when someone
 * accepts an invite has no chat id on the lead yet, and the quick sync skips
 * chats it already holds. This runs after each inbox sync and fixes both.
 */

/** Statuses that should become "replied" once the person has written. */
const NOT_YET_REPLIED = [
  "queued",
  "invited",
  "connected",
  "in_sequence",
  "completed",
  "failed",
];

const CHUNK = 100;

/** Accepts newer than this still get the campaign's next step. */
const RECENT_ACCEPT_MS = 14 * 86_400_000;

function chunks<T>(list: T[], size = CHUNK): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

/**
 * Save the chat id on leads whose chat we hold but never linked, matched by
 * the person's LinkedIn id. Never overwrites a chat id already saved.
 */
export async function linkChatsToLeads(
  coachId: string,
  chats: Array<{ chatId: string; providerId: string | null }>
): Promise<number> {
  const withProvider = chats.filter((c) => c.chatId && c.providerId);
  if (!withProvider.length) return 0;

  const linkedChats = new Set<string>();
  for (const part of chunks(withProvider.map((c) => c.chatId))) {
    const { data } = await supabaseAdmin
      .from("linkedin_campaign_leads")
      .select("unipile_chat_id")
      .eq("coach_id", coachId)
      .in("unipile_chat_id", part);
    for (const row of data ?? []) linkedChats.add(String(row.unipile_chat_id));
  }

  const unlinked = withProvider.filter((c) => !linkedChats.has(c.chatId));
  let linked = 0;
  for (const part of chunks(unlinked)) {
    const chatByProvider = new Map(part.map((c) => [c.providerId as string, c.chatId]));
    const { data: leads } = await supabaseAdmin
      .from("linkedin_campaign_leads")
      .select("id, linkedin_provider_id")
      .eq("coach_id", coachId)
      .is("unipile_chat_id", null)
      .in("linkedin_provider_id", [...chatByProvider.keys()]);
    for (const lead of leads ?? []) {
      const chatId = chatByProvider.get(String(lead.linkedin_provider_id));
      if (!chatId) continue;
      const { error } = await supabaseAdmin
        .from("linkedin_campaign_leads")
        .update({ unipile_chat_id: chatId })
        .eq("id", lead.id)
        .is("unipile_chat_id", null);
      if (!error) linked += 1;
    }
  }
  return linked;
}

/**
 * Leads whose linked chat holds a real message from the person (a 👍 reaction
 * doesn't count) but whose status still says they haven't replied. Marks them
 * replied and cancels their waiting campaign sends, unless the campaign is set
 * to keep going after a reply.
 */
export async function markMissedLeadReplies(
  coachId: string,
  options?: { sinceDays?: number | null }
): Promise<Array<{ leadId: string; name: string }>> {
  let convQuery = supabaseAdmin
    .from("messaging_conversations")
    .select("id, unipile_chat_id")
    .eq("coach_id", coachId)
    .eq("has_inbound", true)
    .not("unipile_chat_id", "is", null);
  if (options?.sinceDays) {
    const since = new Date(Date.now() - options.sinceDays * 86_400_000).toISOString();
    convQuery = convQuery.gte("last_message_at", since);
  }
  const { data: convs } = await convQuery.limit(5000);
  if (!convs?.length) return [];

  const convByChat = new Map(convs.map((c) => [String(c.unipile_chat_id), String(c.id)]));
  const candidates: Array<Record<string, unknown>> = [];
  for (const part of chunks([...convByChat.keys()])) {
    const { data } = await supabaseAdmin
      .from("linkedin_campaign_leads")
      .select("id, campaign_id, unipile_chat_id, first_name, last_name, created_at")
      .eq("coach_id", coachId)
      .in("status", NOT_YET_REPLIED)
      .in("unipile_chat_id", part);
    candidates.push(...(data ?? []));
  }
  if (!candidates.length) return [];

  // Only real messages from the person, not reactions or system events.
  // Latest one per chat, so it can be compared with when the lead was added.
  const lastReplyAt = new Map<string, number>();
  const convIds = [
    ...new Set(candidates.map((l) => convByChat.get(String(l.unipile_chat_id))!)),
  ];
  for (const part of chunks(convIds)) {
    const { data } = await supabaseAdmin
      .from("messaging_messages")
      .select("conversation_id, metadata, created_at")
      .in("conversation_id", part)
      .eq("direction", "inbound");
    for (const m of data ?? []) {
      const meta = (m.metadata as Record<string, unknown> | null) ?? {};
      if (meta.kind === "reaction_event" || meta.is_event === true) continue;
      const at = new Date(String(m.created_at)).getTime();
      const key = String(m.conversation_id);
      if (at > (lastReplyAt.get(key) ?? 0)) lastReplyAt.set(key, at);
    }
  }

  // Any reply stops that person's automatic follow-ups (28 Nov rule).
  const fixed: Array<{ leadId: string; name: string }> = [];
  for (const lead of candidates) {
    const convId = convByChat.get(String(lead.unipile_chat_id));
    if (!convId) continue;
    // Old chat history from before the person joined the campaign isn't a
    // reply to it (e.g. a VIP campaign to people the coach already knows).
    const repliedAt = lastReplyAt.get(convId) ?? 0;
    if (repliedAt < new Date(String(lead.created_at)).getTime()) continue;
    const { data: updated } = await supabaseAdmin
      .from("linkedin_campaign_leads")
      .update({ status: "replied", next_action_at: null })
      .eq("id", lead.id)
      .in("status", NOT_YET_REPLIED)
      .select("id")
      .maybeSingle();
    if (!updated) continue;
    const { cancelOpenSendJobs } = await import("@/lib/unipile/remindQueue");
    await cancelOpenSendJobs(String(lead.id), "Lead replied");
    fixed.push({
      leadId: String(lead.id),
      name: [lead.first_name, lead.last_name].filter(Boolean).join(" "),
    });
  }
  return fixed;
}

/**
 * Leads still "invited" in a running campaign who now show in the coach's
 * LinkedIn connections, connected after the invite. The accept webhook can
 * miss these, which leaves the sequence stuck. Recent accepts move on exactly
 * as the webhook would (connected, next step scheduled). Older ones are only
 * marked connected: a "thanks for connecting" weeks late reads badly.
 */
export async function advanceAcceptedInvites(coachId: string): Promise<number> {
  const { data: running } = await supabaseAdmin
    .from("linkedin_campaigns")
    .select("id")
    .eq("coach_id", coachId)
    .eq("status", "running");
  const runningIds = (running ?? []).map((c) => String(c.id));
  if (!runningIds.length) return 0;

  type InvitedLead = Record<string, unknown> & {
    id: string;
    campaign_id: string;
    pid: string | null;
    invited_at: string | null;
    created_at: string;
  };
  const invited: InvitedLead[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabaseAdmin
      .from("linkedin_campaign_leads")
      .select(
        "id, campaign_id, coach_id, status, current_step_position, linkedin_provider_id, linkedin_url, invitation_id, invited_at, created_at, pid:metadata->>public_identifier"
      )
      .eq("coach_id", coachId)
      .eq("status", "invited")
      .in("campaign_id", runningIds)
      .order("id")
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    invited.push(...((data ?? []) as InvitedLead[]));
    if (!data || data.length < 1000) break;
  }
  const withPid = invited.filter((l) => l.pid);
  if (!withPid.length) return 0;

  const connectedAt = new Map<string, number>();
  const pids = new Set<string>();
  for (const l of withPid) {
    pids.add(String(l.pid));
    pids.add(String(l.pid).toLowerCase());
  }
  for (const part of chunks([...pids])) {
    const { data } = await supabaseAdmin
      .from("coach_network_connections")
      .select("public_identifier, connected_at")
      .eq("coach_id", coachId)
      .in("public_identifier", part);
    for (const row of data ?? []) {
      if (!row.connected_at) continue;
      connectedAt.set(
        String(row.public_identifier).toLowerCase(),
        new Date(String(row.connected_at)).getTime()
      );
    }
  }

  const { advanceLeadAfterInviteAccepted } = await import("@/lib/unipile/worker");
  let advanced = 0;
  for (const lead of withPid) {
    const at = connectedAt.get(String(lead.pid).toLowerCase());
    if (at == null) continue;
    if (at < new Date(lead.invited_at || lead.created_at).getTime()) continue;
    // The webhook may have moved them on since we read the list.
    const { data: still } = await supabaseAdmin
      .from("linkedin_campaign_leads")
      .select("status")
      .eq("id", lead.id)
      .maybeSingle();
    if (still?.status !== "invited") continue;
    if (Date.now() - at > RECENT_ACCEPT_MS) {
      await supabaseAdmin
        .from("linkedin_campaign_leads")
        .update({
          status: "connected",
          connected_at: new Date(at).toISOString(),
          next_action_at: null,
        })
        .eq("id", lead.id)
        .eq("status", "invited");
      advanced += 1;
      continue;
    }
    await advanceLeadAfterInviteAccepted({
      lead,
      campaignId: lead.campaign_id,
      coachId,
      providerId: (lead.linkedin_provider_id as string | null) || null,
    });
    advanced += 1;
  }
  return advanced;
}
