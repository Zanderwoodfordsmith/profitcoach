import { getCoachAuthHeaders, getStoredImpersonatingCoachId } from "@/lib/coachAuthHeaders";
import { getValidSupabaseAccessToken } from "@/lib/supabaseAccessToken";
import { supabaseClient } from "@/lib/supabaseClient";
import { THREAD_LIST_FAST_LIMIT } from "@/lib/messaging/threadWindow";
import type { CallRow } from "@/lib/callRow";
import type { ProspectRow } from "@/lib/prospectRow";
import type { ShareHubPayload } from "@/lib/shareLinks/types";
import { fetchHubQuery, invalidateHubQuery, isHubQueryFresh, peekHubQuery, writeHubQuery } from "@/lib/getClients/hubQueryCache";
import { hubQueryKey } from "@/lib/getClients/hubKeys";

export type CampaignsHubAccount = {
  id: string;
  unipile_account_id: string;
  status: string;
  display_name: string | null;
  provider?: string;
};

export type CampaignsHubPayload = {
  configured: boolean;
  accounts: CampaignsHubAccount[];
  campaigns: Record<string, unknown>[];
  archivedCampaigns: Record<string, unknown>[];
  coachSlug: string | null;
};

export type ProspectsHubPayload = {
  prospects: ProspectRow[];
  coachSlug: string | null;
  coaches: Array<{
    id: string;
    slug: string;
    full_name: string | null;
    coach_business_name: string | null;
  }>;
  userId: string;
  effectiveCoachId: string;
};

export type ConversationsHubPayload = {
  conversations: Array<Record<string, unknown>>;
};

export type ContentHubPayload = {
  connected: boolean;
  profile: {
    name: string | null;
    headline: string | null;
    photoUrl: string | null;
    email: string | null;
    tokenExpiry: string | null;
    scopes: string[];
    websiteLabel: string;
    websiteUrl: string | null;
    quoteHandle: string;
  };
  items: unknown[];
  categories: string[];
};

export type ContentStatusPayload = Pick<ContentHubPayload, "connected" | "profile">;
export type ContentScheduledPayload = Pick<ContentHubPayload, "items" | "categories">;

export type CampaignDetailCorePayload = {
  campaign: Record<string, unknown>;
  steps: unknown[];
  leads: unknown[];
};

export type CampaignDetailExtrasPayload = {
  jobs: unknown[];
  ab: { stats?: Record<string, Record<string, unknown>> } | null;
  activity: { buckets?: unknown[] } | null;
};

export type ProspectContactPayload = {
  prospect: ProspectRow;
  coachSlug: string | null;
};

export type CallsHubPayload = {
  calls: CallRow[];
  coaches: Array<{
    id: string;
    full_name: string | null;
    coach_business_name: string | null;
  }>;
};

async function authHeaders() {
  return getCoachAuthHeaders();
}

function asRecords(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter((row): row is Record<string, unknown> =>
        Boolean(row) && typeof row === "object"
      )
    : [];
}

export async function loadCampaignsHubPayload(): Promise<CampaignsHubPayload> {
  const headers = await authHeaders();
  if (!headers) throw new Error("Sign in required.");
  const [accRes, campRes, archivedRes, profileRes] = await Promise.all([
    fetch("/api/coach/linkedin-outreach/accounts", { headers }),
    fetch("/api/coach/linkedin-outreach/campaigns", { headers }),
    fetch("/api/coach/linkedin-outreach/campaigns?archived=1", { headers }),
    fetch("/api/coach/profile", { headers }),
  ]);
  const accBody = (await accRes.json().catch(() => ({}))) as {
    error?: string;
    configured?: boolean;
    accounts?: CampaignsHubAccount[];
  };
  const campBody = (await campRes.json().catch(() => ({}))) as {
    error?: string;
    campaigns?: unknown[];
  };
  const archivedBody = (await archivedRes.json().catch(() => ({}))) as {
    campaigns?: unknown[];
  };
  const profileBody = (await profileRes.json().catch(() => ({}))) as {
    coach_slug?: unknown;
  };
  if (!accRes.ok) throw new Error(accBody.error || "Could not load accounts.");
  if (!campRes.ok) throw new Error(campBody.error || "Could not load campaigns.");
  return {
    configured: accBody.configured !== false,
    accounts: accBody.accounts ?? [],
    campaigns: asRecords(campBody.campaigns),
    archivedCampaigns: archivedRes.ok ? asRecords(archivedBody.campaigns) : [],
    coachSlug:
      typeof profileBody.coach_slug === "string"
        ? profileBody.coach_slug.trim() || null
        : null,
  };
}

export async function loadShareHubPayload(): Promise<ShareHubPayload> {
  const headers = await authHeaders();
  if (!headers) throw new Error("Sign in to load your links.");
  const res = await fetch("/api/coach/share-hub", { headers });
  const body = (await res.json().catch(() => ({}))) as ShareHubPayload & {
    error?: string;
  };
  if (!res.ok) throw new Error(body.error ?? "Could not load links.");
  return {
    coach_slug: body.coach_slug ?? null,
    linkedin_url: body.linkedin_url ?? null,
    social_links: body.social_links ?? {},
    custom_links: body.custom_links ?? [],
    calendars: body.calendars ?? [],
  };
}

export async function loadConversationsHubPayload(): Promise<ConversationsHubPayload> {
  const headers = await authHeaders();
  if (!headers) throw new Error("Sign in again, then retry.");
  const res = await fetch(
    `/api/messaging/conversations?limit=${encodeURIComponent(String(THREAD_LIST_FAST_LIMIT))}`,
    { headers }
  );
  const body = (await res.json().catch(() => ({}))) as {
    error?: string;
    conversations?: unknown[];
  };
  if (!res.ok) throw new Error(body.error || `Request failed (${res.status}).`);
  return { conversations: asRecords(body.conversations) };
}

function contentProfileFromStatus(statusBody: {
  connected?: boolean;
  connection?: { scope?: string[]; token_expires_at?: string | null } | null;
  account?: { name?: string | null; email?: string | null } | null;
  profile?: {
    name?: string | null;
    headline?: string | null;
    photo_url?: string | null;
    website_label?: string | null;
    website_url?: string | null;
    quote_handle?: string | null;
  } | null;
}): ContentStatusPayload {
  return {
    connected: !!statusBody.connected,
    profile: {
      name: statusBody.profile?.name ?? statusBody.account?.name ?? null,
      headline: statusBody.profile?.headline ?? null,
      photoUrl: statusBody.profile?.photo_url ?? null,
      email: statusBody.account?.email ?? null,
      tokenExpiry: statusBody.connection?.token_expires_at ?? null,
      scopes: statusBody.connection?.scope ?? [],
      websiteLabel: statusBody.profile?.website_label || "Visit my website",
      websiteUrl: statusBody.profile?.website_url ?? null,
      quoteHandle: statusBody.profile?.quote_handle || "Profit Coach",
    },
  };
}

export async function loadContentStatusPayload(): Promise<ContentStatusPayload> {
  const token = await getValidSupabaseAccessToken();
  if (!token) throw new Error("Please sign in again.");
  const headers = { Authorization: `Bearer ${token}` };
  const statusRes = await fetch("/api/linkedin/status", { headers });
  const statusBody = (await statusRes.json().catch(() => ({}))) as Parameters<
    typeof contentProfileFromStatus
  >[0];
  return contentProfileFromStatus(statusBody);
}

export async function loadContentScheduledPayload(): Promise<ContentScheduledPayload> {
  const token = await getValidSupabaseAccessToken();
  if (!token) throw new Error("Please sign in again.");
  const headers = { Authorization: `Bearer ${token}` };
  const scheduledRes = await fetch("/api/linkedin/scheduled", { headers });
  const scheduledBody = (await scheduledRes.json().catch(() => ({}))) as {
    items?: unknown[];
    categories?: string[];
  };
  return {
    items: Array.isArray(scheduledBody.items) ? scheduledBody.items : [],
    categories: Array.isArray(scheduledBody.categories)
      ? scheduledBody.categories
      : [],
  };
}

export async function loadContentHubPayload(): Promise<ContentHubPayload> {
  const [status, scheduled] = await Promise.all([
    loadContentStatusPayload(),
    loadContentScheduledPayload(),
  ]);
  return { ...status, ...scheduled };
}

export function campaignCoreQueryKey(
  campaignId: string,
  impersonatingCoachId?: string | null
) {
  return hubQueryKey(`campaign:${campaignId}:core`, impersonatingCoachId);
}

export function campaignExtrasQueryKey(
  campaignId: string,
  impersonatingCoachId?: string | null
) {
  return hubQueryKey(`campaign:${campaignId}:extras`, impersonatingCoachId);
}

export function prospectContactQueryKey(
  contactId: string,
  admin: boolean,
  impersonatingCoachId?: string | null
) {
  return hubQueryKey(
    `prospect:${admin ? "admin" : "coach"}:${contactId}`,
    impersonatingCoachId
  );
}

export async function loadCampaignCorePayload(
  campaignId: string
): Promise<CampaignDetailCorePayload> {
  const headers = await authHeaders();
  if (!headers) throw new Error("Sign in required.");
  const res = await fetch(
    `/api/coach/linkedin-outreach/campaigns/${encodeURIComponent(campaignId)}?part=core`,
    { headers }
  );
  const body = (await res.json().catch(() => ({}))) as CampaignDetailCorePayload & {
    error?: string;
  };
  if (!res.ok || !body.campaign) {
    throw new Error(body.error || "Campaign not found.");
  }
  return {
    campaign: body.campaign,
    steps: Array.isArray(body.steps) ? body.steps : [],
    leads: Array.isArray(body.leads) ? body.leads : [],
  };
}

export async function loadCampaignExtrasPayload(
  campaignId: string
): Promise<CampaignDetailExtrasPayload> {
  const headers = await authHeaders();
  if (!headers) throw new Error("Sign in required.");
  const res = await fetch(
    `/api/coach/linkedin-outreach/campaigns/${encodeURIComponent(campaignId)}?part=extras`,
    { headers }
  );
  const body = (await res.json().catch(() => ({}))) as CampaignDetailExtrasPayload & {
    error?: string;
  };
  if (!res.ok) {
    throw new Error(body.error || "Could not load campaign activity.");
  }
  return {
    jobs: Array.isArray(body.jobs) ? body.jobs : [],
    ab: body.ab ?? null,
    activity: body.activity ?? null,
  };
}

export async function loadProspectContactPayload(
  contactId: string,
  admin: boolean,
  impersonatingCoachId?: string | null
): Promise<ProspectContactPayload> {
  const headers = admin
    ? await (async () => {
        const token = await getValidSupabaseAccessToken();
        if (!token) return null;
        return { Authorization: `Bearer ${token}` } as Record<string, string>;
      })()
    : await getCoachAuthHeaders(impersonatingCoachId);
  if (!headers) throw new Error("Sign in required.");
  const contactUrl = admin
    ? `/api/admin/contacts/${encodeURIComponent(contactId)}`
    : `/api/coach/contacts/${encodeURIComponent(contactId)}`;
  const res = await fetch(contactUrl, { headers, cache: "no-store" });
  const body = (await res.json().catch(() => ({}))) as ProspectContactPayload & {
    error?: string;
  };
  if (!res.ok || !body.prospect) {
    throw new Error(body.error ?? "Prospect not found.");
  }
  return {
    prospect: body.prospect,
    coachSlug: body.coachSlug ?? null,
  };
}

export async function loadProspectsHubPayload(
  scope: "admin" | "coach"
): Promise<ProspectsHubPayload> {
  const {
    data: { session },
  } = await supabaseClient.auth.getSession();
  const user = session?.user;
  const accessToken = session?.access_token;
  if (!user || !accessToken) throw new Error("Sign in required.");

  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
  };
  const impersonate = getStoredImpersonatingCoachId();
  if (scope === "coach" && impersonate) {
    headers["x-impersonate-coach-id"] = impersonate;
  }

  if (scope === "admin") {
    const [contactsRes, coachesRes] = await Promise.all([
      fetch("/api/admin/contacts?type=prospect", { headers }),
      fetch("/api/admin/coaches", { headers }),
    ]);
    if (!contactsRes.ok) {
      const body = (await contactsRes.json().catch(() => ({}))) as {
        error?: string;
      };
      throw new Error(body?.error ?? "Unable to load prospects.");
    }
    const contactsBody = (await contactsRes.json()) as {
      prospects?: ProspectRow[];
    };
    let coaches: ProspectsHubPayload["coaches"] = [];
    if (coachesRes.ok) {
      const coachesBody = (await coachesRes.json()) as {
        coaches?: Array<{
          id: string;
          slug: string;
          full_name?: string | null;
          coach_business_name?: string | null;
        }>;
      };
      coaches = (coachesBody.coaches ?? []).map((c) => ({
        id: c.id,
        slug: c.slug,
        full_name: c.full_name ?? null,
        coach_business_name: c.coach_business_name ?? null,
      }));
    }
    return {
      prospects: contactsBody.prospects ?? [],
      coachSlug: null,
      coaches,
      userId: user.id,
      effectiveCoachId: user.id,
    };
  }

  const effectiveId = impersonate || user.id;
  const res = await fetch("/api/coach/prospects", { headers });
  const body = (await res.json().catch(() => ({}))) as {
    prospects?: ProspectRow[];
    coachSlug?: string | null;
    error?: string;
  };
  if (!res.ok) throw new Error(body.error ?? "Unable to load prospects.");
  return {
    prospects: body.prospects ?? [],
    coachSlug: body.coachSlug ?? null,
    coaches: [],
    userId: user.id,
    effectiveCoachId: effectiveId,
  };
}

export async function loadCallsHubPayload(options: {
  admin: boolean;
  coachId?: string | null;
}): Promise<CallsHubPayload> {
  const headers = await authHeaders();
  if (!headers) throw new Error("Sign in required.");
  const url = options.admin ? "/api/coach/calls?scope=all" : "/api/coach/calls";
  const res = await fetch(url, { headers });
  const body = (await res.json().catch(() => ({}))) as {
    error?: string;
    calls?: CallRow[];
  };
  if (!res.ok) throw new Error(body.error || "Unable to load calls.");
  const rows = Array.isArray(body.calls) ? body.calls : [];
  if (!options.admin) return { calls: rows, coaches: [] };

  const token = await getValidSupabaseAccessToken();
  if (!token) return { calls: rows, coaches: [] };
  const coachesRes = await fetch("/api/admin/coaches", {
    headers: { Authorization: `Bearer ${token}` },
  });
  let coaches: CallsHubPayload["coaches"] = [];
  if (coachesRes.ok) {
    const coachesBody = (await coachesRes.json()) as {
      coaches?: Array<{
        id: string;
        full_name?: string | null;
        coach_business_name?: string | null;
      }>;
    };
    coaches = (coachesBody.coaches ?? []).map((coach) => ({
      id: coach.id,
      full_name: coach.full_name ?? null,
      coach_business_name: coach.coach_business_name ?? null,
    }));
  }
  return { calls: rows, coaches };
}

function warm<T>(key: string, fetcher: () => Promise<T>) {
  if (isHubQueryFresh(key)) return;
  void fetchHubQuery(key, fetcher).catch(() => {
    /* prefetch is best-effort */
  });
}

export function prefetchCampaignsHub() {
  warm(hubQueryKey("campaigns"), loadCampaignsHubPayload);
}

export function prefetchShareHub() {
  warm(hubQueryKey("share"), loadShareHubPayload);
}

export function prefetchConversationsHub() {
  warm(hubQueryKey("conversations"), loadConversationsHubPayload);
}

export function prefetchContentHub() {
  warm(hubQueryKey("content:status"), loadContentStatusPayload);
  warm(hubQueryKey("content:scheduled"), loadContentScheduledPayload);
}

export function prefetchCampaignDetail(campaignId: string) {
  const id = campaignId.trim();
  if (!id) return;
  warm(campaignCoreQueryKey(id), () => loadCampaignCorePayload(id));
}

export function prefetchProspectContact(
  contactId: string,
  admin: boolean,
  impersonatingCoachId?: string | null
) {
  const id = contactId.trim();
  if (!id) return;
  warm(prospectContactQueryKey(id, admin, impersonatingCoachId), () =>
    loadProspectContactPayload(id, admin, impersonatingCoachId)
  );
}

export function seedProspectContactCache(
  contactId: string,
  admin: boolean,
  prospect: ProspectRow,
  impersonatingCoachId?: string | null
) {
  const key = prospectContactQueryKey(contactId, admin, impersonatingCoachId);
  if (isHubQueryFresh(key)) return;
  writeHubQuery<ProspectContactPayload>(key, { prospect, coachSlug: null });
  invalidateHubQuery(key);
}

export function prefetchProspectsHub(scope: "admin" | "coach") {
  warm(hubQueryKey(`prospects:${scope}`), () => loadProspectsHubPayload(scope));
}

export function prefetchCallsHub(admin: boolean, coachId?: string | null) {
  const key = hubQueryKey(admin ? "calls:admin" : "calls:coach");
  warm(key, () => loadCallsHubPayload({ admin, coachId }));
}

/** Prefetch the list payload for a Get Clients tab href. */
export function prefetchGetClientsHref(href: string): void {
  const path = (href.split("?")[0] ?? href).replace(/\/$/, "");
  const admin = path.startsWith("/admin");
  if (path.endsWith("/campaigns")) prefetchCampaignsHub();
  else if (path.endsWith("/conversations")) prefetchConversationsHub();
  else if (path.endsWith("/calls")) prefetchCallsHub(admin);
  else if (path.endsWith("/prospects")) prefetchProspectsHub(admin ? "admin" : "coach");
  else if (path.endsWith("/linkedin")) prefetchContentHub();
  else if (path.endsWith("/share")) prefetchShareHub();
}
