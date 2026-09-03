import { getAppBaseUrl } from "@/lib/appBaseUrl";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  createHostedAuthLink,
  deleteUnipileAccount,
  getUnipileAccount,
  isUnipileConfigured,
  listUnipileAccounts,
} from "@/lib/unipile/client";
import {
  displayNameFromUnipileAccount,
  isConnectableProvider,
  isMailingProvider,
  normalizeUnipileProvider,
  type UnipileConnectProvider,
  UNIPILE_CONNECT_PROVIDERS,
} from "@/lib/unipile/providers";

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

function settingsReturnPrefix(request: Request): "/coach" | "/admin" {
  const referer = request.headers.get("referer") || "";
  if (referer.includes("/coach/") || referer.includes("/coach?")) return "/coach";
  return "/admin";
}

export async function createProviderConnectLink(
  coachId: string,
  request: Request,
  provider: UnipileConnectProvider,
  options?: { returnTo?: "settings" | "campaigns" | "lead-finder" }
): Promise<{ url: string }> {
  if (!isUnipileConfigured()) {
    throw new Error("Unipile is not configured (UNIPILE_DSN / UNIPILE_API_KEY).");
  }
  if (!isConnectableProvider(provider)) {
    throw new Error(`Unsupported provider: ${provider}`);
  }

  const base = getAppBaseUrl(request);
  const dsn = (process.env.UNIPILE_DSN || "").replace(/\/$/, "");
  const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const returnPrefix = settingsReturnPrefix(request);
  const returnTo = options?.returnTo ?? "settings";
  const successPath =
    returnTo === "campaigns"
      ? `${returnPrefix}/campaigns?linkedin=connected`
      : returnTo === "lead-finder"
        ? "/admin/lead-finder?linkedin=connected"
      : returnPrefix === "/coach"
        ? `${returnPrefix}/settings?tab=profile&connected=${provider}`
        : `${returnPrefix}/account?tab=profile&connected=${provider}`;
  const failurePath =
    returnTo === "campaigns"
      ? `${returnPrefix}/campaigns?linkedin=failed`
      : returnTo === "lead-finder"
        ? "/admin/lead-finder?linkedin=failed"
      : returnPrefix === "/coach"
        ? `${returnPrefix}/settings?tab=profile&connected=failed`
        : `${returnPrefix}/account?tab=profile&connected=failed`;

  const result = await createHostedAuthLink({
    type: "create",
    apiUrl: dsn,
    expiresOn: expires,
    providers: [provider],
    name: coachId,
    success_redirect_url: `${base}${successPath}`,
    failure_redirect_url: `${base}${failurePath}`,
    notify_url: `${base}/api/unipile/notify`,
    bypass_success_screen: true,
  });
  if (!result.ok || !result.data?.url) {
    throw new Error(result.error || "Could not create Unipile connect link.");
  }
  return { url: result.data.url };
}

/** @deprecated Prefer createProviderConnectLink — kept for LinkedIn campaign UIs. */
export async function createLinkedInConnectLink(
  coachId: string,
  request: Request
): Promise<{ url: string }> {
  return createProviderConnectLink(coachId, request, "LINKEDIN", {
    returnTo: "campaigns",
  });
}

/** Persist / refresh accounts for a coach from Unipile list. */
export async function syncOutreachAccountsForCoach(coachId: string) {
  const listed = await listUnipileAccounts();
  if (!listed.ok) throw new Error(listed.error || "Could not list Unipile accounts.");
  const items = listed.data?.items ?? [];
  const now = new Date().toISOString();

  const { data: existing } = await supabaseAdmin
    .from("linkedin_outreach_accounts")
    .select("id, unipile_account_id, provider")
    .eq("coach_id", coachId);
  const known = new Set((existing ?? []).map((r) => r.unipile_account_id as string));
  const knownByProvider = new Map<string, number>();
  for (const row of existing ?? []) {
    const p = normalizeUnipileProvider(row.provider as string);
    knownByProvider.set(p, (knownByProvider.get(p) || 0) + 1);
  }

  const { data: claimedRows } = await supabaseAdmin
    .from("linkedin_outreach_accounts")
    .select("unipile_account_id");
  const claimed = new Set(
    (claimedRows ?? []).map((r) => r.unipile_account_id as string)
  );

  for (const item of items) {
    if (!item?.id) continue;
    const provider = normalizeUnipileProvider(
      String(item.type || item.provider || "")
    );
    if (
      !(UNIPILE_CONNECT_PROVIDERS as readonly string[]).includes(provider) &&
      !isMailingProvider(provider)
    ) {
      continue;
    }

    const name = String(item.name || "");
    const providerCount = knownByProvider.get(provider) || 0;
    const claimForCoach =
      known.has(item.id) ||
      name === coachId ||
      // Dev fallback when notify can't reach localhost: claim one unassigned
      // account per provider type for this coach.
      (providerCount === 0 && !claimed.has(item.id));

    if (!claimForCoach) continue;

    const status = mapAccountStatus(item as Record<string, unknown>);
    const display = displayNameFromUnipileAccount(
      item as Record<string, unknown>,
      coachId
    );

    await supabaseAdmin.from("linkedin_outreach_accounts").upsert(
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
    known.add(item.id);
    claimed.add(item.id);
    knownByProvider.set(provider, providerCount + 1);
  }

  return listOutreachAccounts(coachId);
}

export async function upsertOutreachAccountFromNotify(input: {
  coachId: string;
  unipileAccountId: string;
}) {
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
    throw new Error(remote.error || "Could not delete Unipile account.");
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
        .eq("status", "pending");
    }
  }

  const { error: delErr } = await supabaseAdmin
    .from("linkedin_outreach_accounts")
    .delete()
    .eq("id", outreachAccountId)
    .eq("coach_id", coachId);
  if (delErr) throw new Error(delErr.message);

  return listOutreachAccounts(coachId);
}
