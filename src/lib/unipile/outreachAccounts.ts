import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  deleteUnipileAccount,
  getUnipileAccount,
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
  const raw = (got.data ?? { id: input.unipileAccountId }) as Record<
    string,
    unknown
  >;
  const status = mapAccountStatus(raw);
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
