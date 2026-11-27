import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  deleteUnipileAccount,
  getUnipileAccount,
  isUnipileAccountNotFound,
  isUnipileWorkspaceApiKeyError,
  listUnipileAccounts,
  UNIPILE_WORKSPACE_API_KEY_ERROR,
} from "@/lib/unipile/client";
import {
  displayNameFromUnipileAccount,
  isMailingProvider,
  normalizeUnipileProvider,
  UNIPILE_CONNECT_PROVIDERS,
} from "@/lib/unipile/providers";

export {
  createLinkedInConnectLink,
  createProviderConnectLink,
  parseUnipileConnectReturnTo,
  type UnipileConnectReturnTo,
} from "@/lib/unipile/hostedAuth";

export type OutreachAccountRow = {
  id: string;
  coach_id: string;
  unipile_account_id: string;
  provider: string;
  status: string;
  display_name: string | null;
  last_synced_at: string | null;
};

function mapAccountStatus(raw: Record<string, unknown> | null | undefined): string {
  if (!raw) return "ERROR";
  const sources = raw.sources as Array<{ status?: string }> | undefined;
  const fromSource = sources?.[0]?.status;
  if (fromSource && ["OK", "CONNECTING", "CREDENTIALS", "STOPPED"].includes(fromSource)) {
    return fromSource;
  }
  const cs = String(raw.connection_status || raw.status || "").toUpperCase();
  if (["OK", "CONNECTING", "CREDENTIALS", "STOPPED"].includes(cs)) return cs;
  return "OK";
}

/**
 * Unclaimed Unipile sessions may be claimed only when hosted auth stamped
 * this coach's id onto the account. Auto-claiming "any free Google" is how
 * one coach would see another coach's calendar.
 */
export function shouldClaimUnclaimedUnipileAccount(
  accountName: string,
  coachId: string
): boolean {
  const name = accountName.trim();
  const id = coachId.trim();
  return Boolean(name) && Boolean(id) && name === id;
}

/** Localhost Unipile notify_url never arrives; claim only a just-created mailbox. */
export const RECENT_UNCLAIMED_MAILING_CLAIM_MS = 30 * 60 * 1000;

/**
 * After Google OAuth, Unipile overwrites hosted-auth `name` (coach UUID) with
 * the mailbox email, so UUID matching fails. If this coach has no mailbox of
 * that provider yet, claim an unclaimed mailing account created in the last
 * 30 minutes — the localhost notify gap. Never claim LinkedIn this way.
 */
export function shouldClaimRecentUnclaimedMailingAccount(input: {
  accountName: string;
  coachId: string;
  provider: string;
  createdAt: string | null | undefined;
  coachHasAccountForProvider: boolean;
  nowMs?: number;
}): boolean {
  if (shouldClaimUnclaimedUnipileAccount(input.accountName, input.coachId)) {
    return true;
  }
  if (input.coachHasAccountForProvider) return false;
  if (!isMailingProvider(input.provider)) return false;
  const created = Date.parse(String(input.createdAt || ""));
  if (!Number.isFinite(created)) return false;
  const now = input.nowMs ?? Date.now();
  return now - created >= 0 && now - created <= RECENT_UNCLAIMED_MAILING_CLAIM_MS;
}

function createdAtMs(item: unknown): number {
  const raw =
    item && typeof item === "object"
      ? (item as { created_at?: unknown })
      : null;
  const t = Date.parse(String(raw?.created_at || ""));
  return Number.isFinite(t) ? t : 0;
}

export async function listOutreachAccounts(coachId: string) {
  const { data, error } = await supabaseAdmin
    .from("linkedin_outreach_accounts")
    .select(
      "id, coach_id, unipile_account_id, provider, status, display_name, last_synced_at"
    )
    .eq("coach_id", coachId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as OutreachAccountRow[];
}

/** Connected LinkedIn account that can run outreach and SSI. */
export async function getOkLinkedInAccount(
  coachId: string
): Promise<OutreachAccountRow | null> {
  const accounts = await listOutreachAccounts(coachId);
  return (
    accounts.find(
      (row) =>
        normalizeUnipileProvider(row.provider) === "LINKEDIN" &&
        (row.status || "").toUpperCase() === "OK" &&
        Boolean(row.unipile_account_id?.trim())
    ) ?? null
  );
}

/** Connected Gmail/Outlook/IMAP mailbox that can send coach-identity email. */
export async function getOkMailingAccount(
  coachId: string
): Promise<OutreachAccountRow | null> {
  const accounts = await listOutreachAccounts(coachId);
  return (
    accounts.find(
      (row) =>
        isMailingProvider(row.provider) &&
        (row.status || "").toUpperCase() === "OK" &&
        Boolean(row.unipile_account_id?.trim())
    ) ?? null
  );
}

/** Persist / refresh accounts for a coach from Unipile list. */
export async function syncOutreachAccountsForCoach(coachId: string) {
  const listed = await listUnipileAccounts();
  if (!listed.ok) {
    throw new Error(
      isUnipileWorkspaceApiKeyError(listed)
        ? UNIPILE_WORKSPACE_API_KEY_ERROR
        : listed.error || "Could not list Unipile accounts."
    );
  }
  const items = listed.data?.items ?? [];
  const now = new Date().toISOString();

  const { data: existing } = await supabaseAdmin
    .from("linkedin_outreach_accounts")
    .select("id, unipile_account_id, provider, status")
    .eq("coach_id", coachId);
  const known = new Set((existing ?? []).map((r) => r.unipile_account_id as string));

  const { data: claimedRows } = await supabaseAdmin
    .from("linkedin_outreach_accounts")
    .select("unipile_account_id");
  const claimed = new Set(
    (claimedRows ?? []).map((r) => r.unipile_account_id as string)
  );

  // Never claim the dedicated Support mailbox into a coach CRM account.
  try {
    const { listPlatformUnipileAccountIds } = await import(
      "@/lib/support/mailbox"
    );
    const platformIds = await listPlatformUnipileAccountIds();
    for (const id of platformIds) claimed.add(id);
    // Nor an admin's own WhatsApp linked for Support.
    const { data: lines } = await supabaseAdmin
      .from("support_whatsapp_lines")
      .select("unipile_account_id");
    for (const row of lines ?? []) claimed.add(row.unipile_account_id as string);
  } catch {
    /* ignore during migrate */
  }

  const usable = items.filter((item) => {
    if (!item?.id) return false;
    const provider = normalizeUnipileProvider(
      String(item.type || item.provider || "")
    );
    return (
      (UNIPILE_CONNECT_PROVIDERS as readonly string[]).includes(provider) ||
      isMailingProvider(provider)
    );
  });

  async function persist(item: (typeof usable)[number]) {
    const provider = normalizeUnipileProvider(
      String(item.type || item.provider || "")
    );
    const status = mapAccountStatus(item as Record<string, unknown>);
    const display = displayNameFromUnipileAccount(
      item as Record<string, unknown>,
      coachId
    );
    const { error } = await supabaseAdmin.from("linkedin_outreach_accounts").upsert(
      {
        coach_id: coachId,
        unipile_account_id: item.id,
        provider,
        status,
        display_name: display,
        raw: item,
        last_synced_at: now,
      },
      { onConflict: "coach_id,unipile_account_id" }
    );
    if (error) {
      if (error.code === "23505") return { provider, status };
      throw new Error(error.message);
    }
    known.add(item.id);
    claimed.add(item.id);
    return { provider, status };
  }

  // Refresh rows we already own first so a dead session is not treated as OK.
  for (const item of usable) {
    if (!known.has(item.id)) continue;
    await persist(item);
  }

  const ownedProviders = new Set(
    (existing ?? []).map((r) => normalizeUnipileProvider(r.provider))
  );

  // Hosted auth stamps name=coachId. Unipile then overwrites name with the
  // Gmail address, and localhost notify_url never persists the row — so also
  // claim a just-created unclaimed mailbox when this coach has none yet.
  const unclaimed = usable
    .filter((item) => !known.has(item.id) && !claimed.has(item.id))
    .sort((a, b) => createdAtMs(b) - createdAtMs(a));
  for (const item of unclaimed) {
    const name = String(item.name || "");
    const provider = normalizeUnipileProvider(
      String(item.type || item.provider || "")
    );
    const createdAt =
      item && typeof item === "object"
        ? String((item as { created_at?: unknown }).created_at || "")
        : "";
    if (
      !shouldClaimRecentUnclaimedMailingAccount({
        accountName: name,
        coachId,
        provider,
        createdAt,
        coachHasAccountForProvider: ownedProviders.has(provider),
      })
    ) {
      continue;
    }
    await persist(item);
    ownedProviders.add(provider);
  }

  return listOutreachAccounts(coachId);
}

export async function upsertOutreachAccountFromNotify(input: {
  coachId: string;
  unipileAccountId: string;
}) {
  const { data: existingOwner } = await supabaseAdmin
    .from("linkedin_outreach_accounts")
    .select("coach_id")
    .eq("unipile_account_id", input.unipileAccountId)
    .maybeSingle();
  if (
    existingOwner?.coach_id &&
    existingOwner.coach_id !== input.coachId
  ) {
    throw new Error(
      "This connected account already belongs to another coach."
    );
  }

  const got = await getUnipileAccount(input.unipileAccountId);
  // Reconnects can notify for a session Unipile then merges away. Storing it
  // as OK makes it the "newest LinkedIn" that outreach and SSI pick.
  if (isUnipileAccountNotFound(got)) return;
  const raw = (got.data ?? { id: input.unipileAccountId }) as Record<
    string,
    unknown
  >;
  const status = got.ok ? mapAccountStatus(raw) : "CONNECTING";
  const provider = normalizeUnipileProvider(
    String(raw.type || raw.provider || "LINKEDIN")
  );
  const { error } = await supabaseAdmin.from("linkedin_outreach_accounts").upsert(
    {
      coach_id: input.coachId,
      unipile_account_id: input.unipileAccountId,
      provider,
      status,
      display_name: displayNameFromUnipileAccount(raw, input.coachId),
      raw,
      last_synced_at: new Date().toISOString(),
    },
    { onConflict: "coach_id,unipile_account_id" }
  );
  if (error) throw new Error(error.message);

  if (provider === "LINKEDIN") {
    try {
      await enforceOneLinkedInConnection(input.coachId);
    } catch (err) {
      console.error(
        "one LinkedIn per coach:",
        input.coachId,
        err instanceof Error ? err.message : err
      );
    }
  }
}

type LinkedInConnection = {
  id: string;
  unipileAccountId: string;
  status: string;
  createdAt: string;
  alive: boolean;
  salesNav: boolean;
  personId: string | null;
  live: Record<string, unknown> | null;
};

function linkedInIdentity(raw: unknown): Record<string, unknown> {
  const im = (raw as { connection_params?: { im?: unknown } } | null)
    ?.connection_params?.im;
  return im && typeof im === "object" ? (im as Record<string, unknown>) : {};
}

/** The coach's LinkedIn connections, best first: still there, Sales Navigator, newest. */
async function rankLinkedInConnections(
  coachId: string
): Promise<LinkedInConnection[]> {
  const { data, error } = await supabaseAdmin
    .from("linkedin_outreach_accounts")
    .select("id, unipile_account_id, provider, status, created_at, raw")
    .eq("coach_id", coachId);
  if (error) throw new Error(error.message);
  const rows = (data ?? []).filter(
    (row) =>
      normalizeUnipileProvider(row.provider as string) === "LINKEDIN" &&
      Boolean(String(row.unipile_account_id ?? "").trim())
  );
  const ranked: LinkedInConnection[] = [];
  for (const row of rows) {
    const got = await getUnipileAccount(row.unipile_account_id as string);
    const live = got.ok
      ? ((got.data ?? null) as Record<string, unknown> | null)
      : null;
    const identity = linkedInIdentity(live ?? row.raw);
    const premium = Array.isArray(identity.premiumFeatures)
      ? identity.premiumFeatures.map(String)
      : [];
    ranked.push({
      id: row.id as string,
      unipileAccountId: row.unipile_account_id as string,
      status: String(row.status ?? ""),
      createdAt: String(row.created_at ?? ""),
      // Only a definite "not found" counts as gone: a network blip must
      // never remove a coach's connection.
      alive: !isUnipileAccountNotFound(got),
      salesNav: premium.includes("sales_navigator"),
      personId:
        typeof identity.id === "string" && identity.id ? identity.id : null,
      live,
    });
  }
  return ranked.sort(
    (a, b) =>
      Number(b.alive) - Number(a.alive) ||
      Number(b.salesNav) - Number(a.salesNav) ||
      (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0)
  );
}

/**
 * The LinkedIn to sign in again to when a coach connects LinkedIn, so they
 * never end up with two. Null when they have none still connected.
 */
export async function linkedInToReconnect(
  coachId: string
): Promise<string | null> {
  const [best] = await rankLinkedInConnections(coachId);
  return best?.alive ? best.unipileAccountId : null;
}

/**
 * Delete the removed connection's chats that the kept connection also has
 * (same person, at least as many messages), so Conversations and the
 * contact page don't show them twice. Returns how many were deleted.
 */
export async function dropDuplicateChats(
  coachId: string,
  fromAccountId: string,
  keptAccountId: string
): Promise<number> {
  const load = async (accountId: string) =>
    (
      await supabaseAdmin
        .from("messaging_conversations")
        .select("id, prospect_linkedin_provider_id, prospect_name, last_message_at")
        .eq("coach_id", coachId)
        .eq("unipile_account_id", accountId)
    ).data ?? [];
  // The other person's LinkedIn id; without one, a copy shares the name and
  // the exact time of the last message.
  const personKey = (row: Record<string, unknown>) => {
    const providerId = String(row.prospect_linkedin_provider_id ?? "").trim();
    if (providerId) return `li:${providerId}`;
    const name = String(row.prospect_name ?? "").trim();
    const last = String(row.last_message_at ?? "").trim();
    return name && last ? `name:${name}|${last}` : null;
  };
  const [from, kept] = await Promise.all([
    load(fromAccountId),
    load(keptAccountId),
  ]);
  const keptByPerson = new Map<string, string>();
  for (const row of kept) {
    const key = personKey(row);
    if (key) keptByPerson.set(key, row.id as string);
  }
  const messageCount = async (conversationId: string) =>
    (
      await supabaseAdmin
        .from("messaging_messages")
        .select("id", { count: "exact", head: true })
        .eq("conversation_id", conversationId)
    ).count ?? 0;
  let dropped = 0;
  for (const row of from) {
    const key = personKey(row);
    const twin = key ? keptByPerson.get(key) : undefined;
    if (!twin) continue;
    if ((await messageCount(twin)) < (await messageCount(row.id as string))) {
      continue;
    }
    const { error } = await supabaseAdmin
      .from("messaging_conversations")
      .delete()
      .eq("id", row.id)
      .eq("coach_id", coachId);
    if (error) throw new Error(error.message);
    dropped += 1;
  }
  return dropped;
}

/**
 * One LinkedIn per coach. Keeps the best connection (still there, then
 * Sales Navigator, then newest) and removes the rest. When a removed one is
 * the same LinkedIn person, its campaigns move to the kept one and its
 * copies of chats are dropped; a different person's campaigns are paused.
 */
export async function enforceOneLinkedInConnection(coachId: string): Promise<{
  keptAccountId: string | null;
  removedAccountIds: string[];
}> {
  const [keep, ...rest] = await rankLinkedInConnections(coachId);
  if (!keep) return { keptAccountId: null, removedAccountIds: [] };

  const removedAccountIds: string[] = [];
  for (const other of rest) {
    if (keep.personId && other.personId === keep.personId) {
      await supabaseAdmin
        .from("linkedin_campaigns")
        .update({ outreach_account_id: keep.id })
        .eq("coach_id", coachId)
        .eq("outreach_account_id", other.id);
      await dropDuplicateChats(
        coachId,
        other.unipileAccountId,
        keep.unipileAccountId
      );
    }
    await removeOutreachAccount(coachId, other.id);
    removedAccountIds.push(other.unipileAccountId);
  }

  // A double sign-in can leave the kept row stuck on CONNECTING though
  // LinkedIn reports it fine, and then nothing uses it.
  if (removedAccountIds.length && keep.live) {
    const status = mapAccountStatus(keep.live);
    if (status !== keep.status) {
      await supabaseAdmin
        .from("linkedin_outreach_accounts")
        .update({
          status,
          raw: keep.live,
          last_synced_at: new Date().toISOString(),
        })
        .eq("id", keep.id);
    }
  }

  return { keptAccountId: keep.unipileAccountId, removedAccountIds };
}

/**
 * Disconnect any Unipile account. LinkedIn campaigns that used this account
 * are paused when the row was LinkedIn.
 */
export async function removeOutreachAccount(
  coachId: string,
  outreachAccountId: string
) {
  const { data: row, error } = await supabaseAdmin
    .from("linkedin_outreach_accounts")
    .select("id, unipile_account_id, provider")
    .eq("id", outreachAccountId)
    .eq("coach_id", coachId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!row) throw new Error("Connection not found.");

  const remote = await deleteUnipileAccount(row.unipile_account_id as string);
  if (!remote.ok && remote.status !== 404) {
    console.error("unipile delete account failed:", {
      status: remote.status,
      error: remote.error,
    });
  }

  const provider = normalizeUnipileProvider(row.provider as string);
  if (provider === "LINKEDIN") {
    await supabaseAdmin
      .from("linkedin_campaigns")
      .update({ status: "paused", outreach_account_id: null })
      .eq("coach_id", coachId)
      .eq("outreach_account_id", outreachAccountId)
      .eq("status", "running");

    const { data: linkedCampaigns } = await supabaseAdmin
      .from("linkedin_campaigns")
      .select("id")
      .eq("coach_id", coachId)
      .eq("outreach_account_id", outreachAccountId);
    const campaignIds = (linkedCampaigns ?? []).map((c) => c.id as string);

    await supabaseAdmin
      .from("linkedin_campaigns")
      .update({ outreach_account_id: null })
      .eq("coach_id", coachId)
      .eq("outreach_account_id", outreachAccountId);

    if (campaignIds.length) {
      await supabaseAdmin
        .from("linkedin_send_jobs")
        .update({ status: "cancelled", last_error: "LinkedIn disconnected" })
        .eq("coach_id", coachId)
        .in("campaign_id", campaignIds)
        .in("status", ["pending", "awaiting_coach"]);
    }
  }

  const { error: delErr } = await supabaseAdmin
    .from("linkedin_outreach_accounts")
    .delete()
    .eq("id", outreachAccountId)
    .eq("coach_id", coachId);
  if (delErr) throw new Error(delErr.message);

  const unipileAccountId = String(row.unipile_account_id ?? "").trim();
  if (unipileAccountId) {
    await supabaseAdmin
      .from("coach_unipile_calendar_prefs")
      .delete()
      .eq("coach_id", coachId)
      .eq("unipile_account_id", unipileAccountId);
  }

  return listOutreachAccounts(coachId);
}
