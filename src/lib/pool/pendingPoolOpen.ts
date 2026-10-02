"use client";

import { getCoachAuthHeaders } from "@/lib/coachAuthHeaders";
import type { ProspectRow } from "@/lib/prospectRow";
import { resolveProspectStatus } from "@/lib/prospectStatus";

export type PendingPoolPerson = {
  id: string;
  full_name: string;
  job_title: string | null;
  company: string | null;
  email: string | null;
  phone: string | null;
  linkedin_url: string | null;
  website: string | null;
  tags: string[];
};

export type PoolOpenResponse = {
  error?: string;
  href?: string;
  contactId?: string;
  conversation?: { id: string } | null;
};

const pending = new Map<string, PendingPoolPerson>();
const inflight = new Map<string, Promise<PoolOpenResponse>>();

export function stashPendingPoolPerson(row: PendingPoolPerson) {
  pending.set(row.id, row);
}

export function peekPendingPoolPerson(itemId: string): PendingPoolPerson | null {
  return pending.get(itemId) ?? null;
}

export function poolPersonHref(contactId: string, isAdmin: boolean): string {
  const base = isAdmin
    ? `/admin/prospects/${encodeURIComponent(contactId)}`
    : `/coach/prospects/${encodeURIComponent(contactId)}`;
  return `${base}?from=pool`;
}

export function poolOpenHref(itemId: string, isAdmin: boolean): string {
  const base = isAdmin ? "/admin/prospects/open" : "/coach/prospects/open";
  return `${base}?item=${encodeURIComponent(itemId)}&from=pool`;
}

export function liteProspectFromPool(
  row: Omit<PendingPoolPerson, "id">,
  contactId: string
): ProspectRow {
  return {
    id: contactId,
    full_name: row.full_name,
    job_title: row.job_title,
    email: row.email,
    business_name: row.company,
    linkedin_url: row.linkedin_url,
    company_website: row.website,
    phone: row.phone,
    type: "prospect",
    prospect_status: "leads",
    status: resolveProspectStatus({
      prospect_status: "leads",
      last_completed_at: null,
      next_call: null,
      last_past_call_status: null,
      next_action: null,
    }),
    boss_score: null,
    boss_score_at: null,
    boss_score_report_token: null,
    boss_score_premium: null,
    boss_score_premium_at: null,
    boss_score_premium_source: null,
    last_assessed_at: null,
    revenue: null,
    team_size: null,
    years_in_business: null,
    outcome: null,
    obstacles: null,
    preferred_support: null,
    boss_level: null,
    tags: row.tags,
  };
}

export function requestPoolPersonOpen(
  itemId: string,
  impersonate?: string | null
): Promise<PoolOpenResponse> {
  const key = `${(impersonate || "").trim() || "_"}:${itemId}`;
  const existing = inflight.get(key);
  if (existing) return existing;

  const request = (async (): Promise<PoolOpenResponse> => {
    const headers = await getCoachAuthHeaders(impersonate);
    if (!headers) return { error: "Sign in again, then retry." };
    const res = await fetch(
      `/api/coach/pool/items/${encodeURIComponent(itemId)}/open`,
      { method: "POST", headers }
    );
    const body = (await res.json().catch(() => ({}))) as PoolOpenResponse;
    if (!res.ok || !body.contactId) {
      return { error: body.error || "Could not open this person." };
    }
    return body;
  })().catch(() => ({ error: "Could not open this person." }));

  inflight.set(key, request);
  void request.finally(() => {
    if (inflight.get(key) === request) inflight.delete(key);
  });
  return request;
}
