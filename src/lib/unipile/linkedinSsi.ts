import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { fetchOwnLinkedInSsi } from "@/lib/unipile/client";
import { getOkLinkedInAccount } from "@/lib/unipile/outreachAccounts";

const FRESH_MS = 12 * 60 * 60 * 1000;
const FAIL_BACKOFF_MS = 60 * 60 * 1000;
const REFRESH_MIN_MS = 15 * 60 * 1000;

export const SSI_PILLARS = [
  {
    id: "brand",
    label: "Establish your professional brand",
    max: 25,
  },
  {
    id: "people",
    label: "Find the right people",
    max: 25,
  },
  {
    id: "engagement",
    label: "Engage with insights",
    max: 25,
  },
  {
    id: "relationships",
    label: "Build relationships",
    max: 25,
  },
] as const;

export type SsiPillarId = (typeof SSI_PILLARS)[number]["id"];

export type SsiPillarScore = {
  id: SsiPillarId;
  label: string;
  score: number;
  max: number;
};

export type LinkedInSsiSnapshot = {
  score: number;
  industryTop: number | null;
  networkTop: number | null;
  pillars: SsiPillarScore[];
};

export type CoachLinkedInSsiResult =
  | {
      available: true;
      score: number;
      industryTop: number | null;
      networkTop: number | null;
      pillars: SsiPillarScore[];
      fetchedAt: string;
      stale: boolean;
    }
  | {
      available: false;
      reason: "not_connected" | "unavailable";
      message: string;
    };

type CachedSsi = Extract<CoachLinkedInSsiResult, { available: true }>;

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function clampPercent(n: number): number | null {
  if (!Number.isFinite(n) || n < 0 || n > 100) return null;
  return Math.round(n * 10) / 10;
}

function clampPillar(n: number): number | null {
  if (!Number.isFinite(n) || n < 0 || n > 25) return null;
  return Math.round(n * 10) / 10;
}

function pillarIdFromRaw(raw: string): SsiPillarId | null {
  const key = raw.toUpperCase().replace(/[\s-]+/g, "_");
  if (key.includes("BRAND") || key.includes("PROFESSIONAL")) return "brand";
  if (key.includes("PEOPLE") || key.includes("FIND_RIGHT")) return "people";
  if (key.includes("INSIGHT") || key.includes("ENGAGE")) return "engagement";
  if (key.includes("RELATION")) return "relationships";
  return null;
}

function scoreFromSubScore(rec: Record<string, unknown>): number | null {
  const nested = asRecord(rec.score);
  return (
    asFiniteNumber(rec.score) ??
    asFiniteNumber(rec.ssi) ??
    asFiniteNumber(rec.value) ??
    asFiniteNumber(nested?.overall) ??
    asFiniteNumber(nested?.score)
  );
}

export function parseSsiPillars(payload: unknown): SsiPillarScore[] {
  const byId = new Map<SsiPillarId, number>();
  const lists: unknown[] = [];
  if (Array.isArray(payload)) lists.push(payload);
  const rec = asRecord(payload);
  if (rec) {
    lists.push(rec.subScores, rec.sub_scores, rec.pillars);
  }
  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      const row = asRecord(item);
      if (!row) continue;
      const id =
        pillarIdFromRaw(String(row.pillar ?? row.type ?? row.name ?? row.id ?? "")) ??
        pillarIdFromRaw(String(row.pillarType ?? ""));
      if (!id || byId.has(id)) continue;
      const scoreRaw = scoreFromSubScore(row);
      const score = scoreRaw == null ? null : clampPillar(scoreRaw);
      if (score == null) continue;
      byId.set(id, score);
    }
  }
  return SSI_PILLARS.flatMap((spec) => {
    const score = byId.get(spec.id);
    if (score == null) return [];
    return [{ id: spec.id, label: spec.label, score, max: spec.max }];
  });
}

export function pillarsToCache(pillars: SsiPillarScore[]): Record<SsiPillarId, number> {
  const out = {} as Record<SsiPillarId, number>;
  for (const pillar of pillars) out[pillar.id] = pillar.score;
  return out;
}

export function pillarsFromCache(value: unknown): SsiPillarScore[] {
  const rec = asRecord(value);
  if (!rec) return [];
  return SSI_PILLARS.flatMap((spec) => {
    const scoreRaw = asFiniteNumber(rec[spec.id]);
    const score = scoreRaw == null ? null : clampPillar(scoreRaw);
    if (score == null) return [];
    return [{ id: spec.id, label: spec.label, score, max: spec.max }];
  });
}

function unwrapUnipileRaw(payload: unknown): unknown {
  const rec = asRecord(payload);
  if (!rec) return payload;
  if (rec.object === "LinkedinRawData" && "data" in rec) return rec.data;
  if (
    rec.data != null &&
    asRecord(rec.data) &&
    rec.memberScore == null &&
    rec.ssi == null &&
    rec.socialSellingIndex == null
  ) {
    return rec.data;
  }
  return payload;
}

function pickPercentile(group: unknown): number | null {
  const rec = asRecord(group);
  if (!rec) return null;
  const raw =
    asFiniteNumber(rec.rank) ??
    asFiniteNumber(rec.top) ??
    asFiniteNumber(rec.industryPercentile) ??
    asFiniteNumber(rec.percentile) ??
    asFiniteNumber(rec.industryTop) ??
    asFiniteNumber(rec.networkTop);
  return raw == null ? null : clampPercent(raw);
}

function pickGroupRank(
  groups: unknown,
  groupType: "INDUSTRY" | "NETWORK"
): number | null {
  if (!Array.isArray(groups)) return null;
  for (const item of groups) {
    const rec = asRecord(item);
    if (!rec) continue;
    if (String(rec.groupType || "").toUpperCase() !== groupType) continue;
    return pickPercentile(rec);
  }
  return null;
}

function pickOverallScore(rec: Record<string, unknown> | null): number | null {
  if (!rec) return null;
  const nested = asRecord(rec.score);
  return (
    asFiniteNumber(rec.overall) ??
    asFiniteNumber(rec.ssi) ??
    asFiniteNumber(rec.score) ??
    asFiniteNumber(nested?.overall)
  );
}

export function parseLinkedInSsi(payload: unknown): LinkedInSsiSnapshot | null {
  const root = asRecord(unwrapUnipileRaw(payload));
  if (!root) return null;

  const member = asRecord(root.memberScore);
  const ssiObj = asRecord(root.ssi) ?? asRecord(root.socialSellingIndex);
  const current = asRecord(ssiObj?.currentSsi) ?? asRecord(ssiObj?.currentScore);

  const scoreRaw =
    pickOverallScore(member) ??
    asFiniteNumber(current?.score) ??
    asFiniteNumber(ssiObj?.score) ??
    asFiniteNumber(ssiObj?.currentScore) ??
    asFiniteNumber(root.ssi);

  const score = scoreRaw == null ? null : clampPercent(scoreRaw);
  if (score == null) return null;

  const pillars = parseSsiPillars({
    subScores: [
      ...(Array.isArray(member?.subScores) ? member.subScores : []),
      ...(Array.isArray(current?.subScores) ? current.subScores : []),
      ...(Array.isArray(ssiObj?.subScores) ? ssiObj.subScores : []),
    ],
  });

  return {
    score,
    industryTop:
      pickPercentile(root.industry) ?? pickGroupRank(root.groupScore, "INDUSTRY"),
    networkTop:
      pickPercentile(root.network) ?? pickGroupRank(root.groupScore, "NETWORK"),
    pillars,
  };
}

function publicFetchError(status: number, error?: string, type?: string): string {
  const blob = `${error ?? ""} ${type ?? ""}`.toLowerCase();
  if (
    status === 401 ||
    blob.includes("disconnected_account") ||
    blob.includes("no_client_session") ||
    blob.includes("expired_credentials")
  ) {
    return "Reconnect LinkedIn to load SSI.";
  }
  if (
    status === 403 ||
    blob.includes("feature_not_subscribed") ||
    blob.includes("subscription_required") ||
    blob.includes("insufficient_privileges")
  ) {
    return "Sales Navigator is needed to load SSI.";
  }
  return "Couldn't load SSI right now.";
}

function ageMs(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  return Date.now() - t;
}

function snapshotFromRow(row: {
  ssi_score: number | string | null;
  ssi_industry_top: number | string | null;
  ssi_network_top: number | string | null;
  ssi_pillars: unknown;
  ssi_fetched_at: string | null;
}): CachedSsi | null {
  const scoreRaw = asFiniteNumber(row.ssi_score);
  const score = scoreRaw == null ? null : clampPercent(scoreRaw);
  if (score == null || !row.ssi_fetched_at) return null;
  const industryRaw = asFiniteNumber(row.ssi_industry_top);
  const networkRaw = asFiniteNumber(row.ssi_network_top);
  return {
    available: true,
    score,
    industryTop: industryRaw == null ? null : clampPercent(industryRaw),
    networkTop: networkRaw == null ? null : clampPercent(networkRaw),
    pillars: pillarsFromCache(row.ssi_pillars),
    fetchedAt: row.ssi_fetched_at,
    stale: false,
  };
}

/**
 * Own LinkedIn SSI for the signed-in coach's connected account.
 * Never accepts another person's identifier. Account is resolved from coachId.
 */
export async function loadCoachOwnLinkedInSsi(
  coachId: string,
  options?: { refresh?: boolean }
): Promise<CoachLinkedInSsiResult> {
  const account = await getOkLinkedInAccount(coachId);
  if (!account) {
    return {
      available: false,
      reason: "not_connected",
      message: "Connect LinkedIn to see your SSI.",
    };
  }

  const { data: cached } = await supabaseAdmin
    .from("linkedin_outreach_accounts")
    .select(
      "id, unipile_account_id, ssi_score, ssi_industry_top, ssi_network_top, ssi_pillars, ssi_fetched_at, ssi_error"
    )
    .eq("id", account.id)
    .eq("coach_id", coachId)
    .maybeSingle();

  const fetchedAge = ageMs(cached?.ssi_fetched_at as string | null);
  const cachedSnapshot = cached
    ? snapshotFromRow({
        ssi_score: (cached.ssi_score as number | string | null) ?? null,
        ssi_industry_top:
          (cached.ssi_industry_top as number | string | null) ?? null,
        ssi_network_top:
          (cached.ssi_network_top as number | string | null) ?? null,
        ssi_pillars: cached.ssi_pillars,
        ssi_fetched_at: (cached.ssi_fetched_at as string | null) ?? null,
      })
    : null;
  const lastError = String(cached?.ssi_error || "").trim();

  const refresh = options?.refresh === true;
  const freshSuccess =
    cachedSnapshot && fetchedAge != null && fetchedAge < FRESH_MS;
  const recentFail =
    lastError && fetchedAge != null && fetchedAge < FAIL_BACKOFF_MS;
  const refreshTooSoon =
    refresh && fetchedAge != null && fetchedAge < REFRESH_MIN_MS;

  if (freshSuccess && !refresh) return cachedSnapshot;
  if (freshSuccess && refreshTooSoon) return cachedSnapshot;
  if (!cachedSnapshot && recentFail && !refresh) {
    return {
      available: false,
      reason: "unavailable",
      message: lastError,
    };
  }

  const fetched = await fetchOwnLinkedInSsi(account.unipile_account_id);
  const now = new Date().toISOString();

  if (!fetched.ok) {
    const type =
      asRecord(fetched.raw)?.type != null
        ? String(asRecord(fetched.raw)?.type)
        : undefined;
    const message = publicFetchError(fetched.status, fetched.error, type);
    console.warn("linkedin ssi fetch failed", {
      coachId,
      status: fetched.status,
      type: type || null,
    });
    await supabaseAdmin
      .from("linkedin_outreach_accounts")
      .update({ ssi_fetched_at: now, ssi_error: message })
      .eq("id", account.id)
      .eq("coach_id", coachId);
    if (cachedSnapshot) return { ...cachedSnapshot, stale: true };
    return { available: false, reason: "unavailable", message };
  }

  const parsed = parseLinkedInSsi(fetched.data);
  if (!parsed) {
    const message = "Couldn't read SSI from LinkedIn.";
    await supabaseAdmin
      .from("linkedin_outreach_accounts")
      .update({ ssi_fetched_at: now, ssi_error: message })
      .eq("id", account.id)
      .eq("coach_id", coachId);
    if (cachedSnapshot) return { ...cachedSnapshot, stale: true };
    return { available: false, reason: "unavailable", message };
  }

  await supabaseAdmin
    .from("linkedin_outreach_accounts")
    .update({
      ssi_score: parsed.score,
      ssi_industry_top: parsed.industryTop,
      ssi_network_top: parsed.networkTop,
      ssi_pillars: pillarsToCache(parsed.pillars),
      ssi_fetched_at: now,
      ssi_error: null,
    })
    .eq("id", account.id)
    .eq("coach_id", coachId);

  return {
    available: true,
    score: parsed.score,
    industryTop: parsed.industryTop,
    networkTop: parsed.networkTop,
    pillars: parsed.pillars,
    fetchedAt: now,
    stale: false,
  };
}
