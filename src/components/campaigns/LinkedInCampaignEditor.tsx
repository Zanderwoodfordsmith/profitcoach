"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { supabaseClient } from "@/lib/supabaseClient";
import type { CampaignActivityDay } from "@/components/campaigns/CampaignOverviewMetrics";
import {
  buildCampaignDials,
  CampaignDailyStackChart,
  CampaignDialsPanel,
} from "@/components/campaigns/CampaignOverviewMetrics";

type Account = {
  id: string;
  status: string;
  display_name: string | null;
};

type Campaign = {
  id: string;
  name: string;
  status: string;
  daily_invite_limit: number;
  min_action_delay_seconds: number;
  outreach_account_id: string | null;
};

type Step = {
  id?: string;
  position: number;
  step_type: "invite" | "message" | "wait" | "comment" | "react";
  body: string | null;
  wait_hours: number | null;
  variants?: Array<{ key: string; label?: string; body: string }> | null;
  send_mode?: "auto" | "remind" | null;
  fallback_hours?: number | null;
  fallback_body?: string | null;
};

type Lead = {
  id: string;
  linkedin_url: string | null;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  title?: string | null;
  status: string;
  interest_outcome?: string | null;
  last_error: string | null;
  current_step_position?: number;
};

type PlaybookMeta = {
  id: string;
  name: string;
  channel: string;
  description: string;
  step_count: number;
};

type TabId = "overview" | "prospects" | "steps" | "settings";

type LeadDrawerFilter =
  | { kind: "status"; status: string; title: string }
  | { kind: "step"; position: number; title: string }
  | { kind: "hopper"; hopper: "staging" | "active"; title: string };

async function authHeaders(): Promise<HeadersInit | null> {
  const {
    data: { session },
  } = await supabaseClient.auth.getSession();
  if (!session?.access_token) return null;
  return {
    Authorization: `Bearer ${session.access_token}`,
    "Content-Type": "application/json",
  };
}

function statusLabel(status: string) {
  if (status === "running") return "Active";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function statusTone(status: string) {
  switch (status) {
    case "running":
      return "bg-emerald-50 text-emerald-700";
    case "paused":
      return "bg-amber-50 text-amber-800";
    case "completed":
      return "bg-slate-100 text-slate-600";
    default:
      return "bg-sky-50 text-sky-800";
  }
}

function stepTypeLabel(type: Step["step_type"]) {
  switch (type) {
    case "invite":
      return "Connection request";
    case "react":
      return "Like post";
    case "comment":
      return "Comment";
    case "message":
      return "Message";
    case "wait":
      return "Wait";
  }
}

function leadName(lead: Lead) {
  return (
    [lead.first_name, lead.last_name].filter(Boolean).join(" ") ||
    lead.linkedin_url ||
    "Unknown"
  );
}

function isStagingStatus(status: string) {
  return status === "queued";
}

function isActiveStatus(status: string) {
  return ["invited", "connected", "in_sequence", "paused"].includes(status);
}

function formatWait(hours: number | null | undefined) {
  const h = hours ?? 24;
  if (h >= 24 && h % 24 === 0) return `${h / 24}d`;
  if (h >= 1) return `${h}h`;
  return `${Math.round(h * 60)}m`;
}

const TAB_ITEMS: Array<{ id: TabId; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "prospects", label: "Prospects" },
  { id: "steps", label: "Steps" },
  { id: "settings", label: "Settings" },
];

export function LinkedInCampaignEditor() {
  const params = useParams();
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const prefix = pathname.startsWith("/admin") ? "/admin" : "/coach";
  const campaignId = String(params.id || "");

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importText, setImportText] = useState("");
  const [tab, setTab] = useState<TabId>("overview");
  const [audienceMode, setAudienceMode] = useState<"urls" | "search">("urls");
  const [searchUrl, setSearchUrl] = useState("");
  const [searchKeywords, setSearchKeywords] = useState("");
  const [searchHits, setSearchHits] = useState<
    Array<{
      linkedin_url: string | null;
      first_name: string | null;
      last_name: string | null;
      company: string | null;
      title: string | null;
      linkedin_provider_id?: string | null;
    }>
  >([]);
  const [playbooks, setPlaybooks] = useState<PlaybookMeta[]>([]);
  const [abStats, setAbStats] = useState<Record<
    string,
    Record<string, { assigned: number; interested: number; replied: number }>
  > | null>(null);
  const [activityBuckets, setActivityBuckets] = useState<CampaignActivityDay[]>(
    []
  );
  const [searchCursor, setSearchCursor] = useState<string | null>(null);
  const [editingStepIndex, setEditingStepIndex] = useState<number | null>(null);
  const [leadDrawer, setLeadDrawer] = useState<LeadDrawerFilter | null>(null);
  const [addLeadsOpen, setAddLeadsOpen] = useState(false);
  const [addStepOpen, setAddStepOpen] = useState(false);

  const primaryAccount = accounts[0] ?? null;

  const load = useCallback(async () => {
    const headers = await authHeaders();
    if (!headers || !campaignId) return;
    const [accRes, detailRes] = await Promise.all([
      fetch("/api/coach/linkedin-outreach/accounts", { headers }),
      fetch(
        `/api/coach/linkedin-outreach/campaigns/${encodeURIComponent(campaignId)}`,
        { headers }
      ),
    ]);
    const accBody = await accRes.json().catch(() => ({}));
    const detail = await detailRes.json().catch(() => ({}));
    if (!accRes.ok) throw new Error(accBody.error || "Accounts failed.");
    if (!detailRes.ok) throw new Error(detail.error || "Campaign not found.");
    setAccounts(accBody.accounts ?? []);
    setCampaign(detail.campaign);
    setSteps(detail.steps ?? []);
    setLeads(detail.leads ?? []);
    setAbStats(detail.ab?.stats ?? null);
    setActivityBuckets(detail.activity?.buckets ?? []);
    const pbRes = await fetch(
      "/api/coach/linkedin-outreach/interest?view=playbooks",
      { headers }
    );
    const pbBody = await pbRes.json().catch(() => ({}));
    if (pbRes.ok) setPlaybooks(pbBody.playbooks ?? []);
  }, [campaignId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        await load();
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Load failed.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  const statusCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const l of leads) map[l.status] = (map[l.status] || 0) + 1;
    return map;
  }, [leads]);

  const stagingLeads = useMemo(
    () => leads.filter((l) => isStagingStatus(l.status)),
    [leads]
  );
  const activeLeads = useMemo(
    () => leads.filter((l) => isActiveStatus(l.status)),
    [leads]
  );

  const drawerLeads = useMemo(() => {
    if (!leadDrawer) return [];
    if (leadDrawer.kind === "status") {
      return leads.filter((l) => l.status === leadDrawer.status);
    }
    if (leadDrawer.kind === "hopper") {
      return leadDrawer.hopper === "staging" ? stagingLeads : activeLeads;
    }
    return leads.filter(
      (l) => (l.current_step_position ?? 0) === leadDrawer.position
    );
  }, [leadDrawer, leads, stagingLeads, activeLeads]);

  const editingStep =
    editingStepIndex !== null ? (steps[editingStepIndex] ?? null) : null;

  async function saveSettings(patch: Record<string, unknown>) {
    if (!campaignId) return;
    setBusy(true);
    setError(null);
    try {
      const headers = await authHeaders();
      if (!headers) throw new Error("Sign in required.");
      const res = await fetch(
        `/api/coach/linkedin-outreach/campaigns/${encodeURIComponent(campaignId)}`,
        { method: "PATCH", headers, body: JSON.stringify(patch) }
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Update failed.");
      if (body.campaign) setCampaign(body.campaign);
      else await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed.");
    } finally {
      setBusy(false);
    }
  }

  async function saveSteps(nextSteps?: Step[]) {
    if (!campaignId) return;
    const payload = nextSteps ?? steps;
    setBusy(true);
    setError(null);
    try {
      const headers = await authHeaders();
      if (!headers) throw new Error("Sign in required.");
      const res = await fetch(
        `/api/coach/linkedin-outreach/campaigns/${encodeURIComponent(campaignId)}`,
        { method: "PATCH", headers, body: JSON.stringify({ steps: payload }) }
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Save failed.");
      setSteps(body.steps ?? payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  }

  async function applyPlaybook(playbookId: string) {
    if (!campaignId) return;
    if (
      !window.confirm(
        "Replace this campaign's sequence with the playbook? Unsaved edits will be lost."
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const headers = await authHeaders();
      if (!headers) throw new Error("Sign in required.");
      const res = await fetch(
        `/api/coach/linkedin-outreach/campaigns/${encodeURIComponent(campaignId)}`,
        {
          method: "PATCH",
          headers,
          body: JSON.stringify({
            action: "apply_playbook",
            playbook_id: playbookId,
          }),
        }
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Could not apply playbook.");
      setSteps(body.steps ?? []);
      setEditingStepIndex(null);
      setTab("steps");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Playbook failed.");
    } finally {
      setBusy(false);
    }
  }

  async function markLeadInterest(leadId: string, outcome: string) {
    setBusy(true);
    try {
      const headers = await authHeaders();
      if (!headers) return;
      await fetch("/api/coach/linkedin-outreach/interest", {
        method: "POST",
        headers,
        body: JSON.stringify({ lead_id: leadId, outcome }),
      });
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function importLeadsFromPayload(
    leadsPayload: Array<Record<string, unknown>>
  ) {
    if (!campaignId || !leadsPayload.length) return;
    setBusy(true);
    setError(null);
    try {
      const headers = await authHeaders();
      if (!headers) throw new Error("Sign in required.");
      const res = await fetch(
        `/api/coach/linkedin-outreach/campaigns/${encodeURIComponent(campaignId)}`,
        {
          method: "PATCH",
          headers,
          body: JSON.stringify({ action: "add_leads", leads: leadsPayload }),
        }
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Import failed.");
      await load();
      setAddLeadsOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setBusy(false);
    }
  }

  async function importLeads() {
    if (!campaignId) return;
    const lines = importText
      .split(/\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    const leadsPayload = lines.map((line) => {
      const parts = line.split(/,|\t/).map((p) => p.trim());
      return {
        linkedin_url: parts[0] || line,
        first_name: parts[1] || null,
        last_name: parts[2] || null,
        company: parts[3] || null,
        title: parts[4] || null,
      };
    });
    setImportText("");
    await importLeadsFromPayload(leadsPayload);
  }

  async function runLinkedInSearch(nextCursor?: string | null) {
    setBusy(true);
    setError(null);
    try {
      const headers = await authHeaders();
      if (!headers) throw new Error("Sign in required.");
      const res = await fetch("/api/coach/linkedin-outreach/search", {
        method: "POST",
        headers,
        body: JSON.stringify(
          nextCursor
            ? { cursor: nextCursor }
            : searchUrl.trim()
              ? { url: searchUrl.trim() }
              : { keywords: searchKeywords.trim() }
        ),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Search failed.");
      setSearchHits(body.items ?? []);
      setSearchCursor(body.cursor ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteLead(leadId: string) {
    if (!campaignId) return;
    setBusy(true);
    try {
      const headers = await authHeaders();
      if (!headers) return;
      await fetch(
        `/api/coach/linkedin-outreach/campaigns/${encodeURIComponent(campaignId)}`,
        {
          method: "PATCH",
          headers,
          body: JSON.stringify({ action: "delete_lead", lead_id: leadId }),
        }
      );
      await load();
    } finally {
      setBusy(false);
    }
  }

  function updateEditingStep(patch: Partial<Step>) {
    if (editingStepIndex === null) return;
    const next = [...steps];
    next[editingStepIndex] = { ...next[editingStepIndex], ...patch };
    setSteps(next);
  }

  function enableAbOnEditingStep() {
    if (editingStepIndex === null || !editingStep) return;
    if (editingStep.variants && editingStep.variants.length > 0) return;
    const body = editingStep.body || "";
    updateEditingStep({
      variants: [
        { key: "A", label: "Variant A", body },
        { key: "B", label: "Variant B", body },
      ],
      body,
    });
  }

  function disableAbOnEditingStep() {
    if (editingStepIndex === null || !editingStep) return;
    const body = editingStep.variants?.[0]?.body ?? editingStep.body ?? "";
    updateEditingStep({ variants: null, body });
  }

  function addStep(type: Step["step_type"]) {
    const next: Step[] = [
      ...steps,
      {
        position: steps.length,
        step_type: type,
        body: type === "wait" || type === "react" ? null : "",
        wait_hours: type === "wait" ? 24 : null,
        send_mode: type === "message" ? "auto" : "auto",
        fallback_hours: null,
        fallback_body: null,
      },
    ];
    setSteps(next);
    setAddStepOpen(false);
    setEditingStepIndex(next.length - 1);
  }

  function countAtStep(step: Step, index: number) {
    return leads.filter(
      (l) => (l.current_step_position ?? 0) === (step.position ?? index)
    ).length;
  }

  if (loading) {
    return (
      <div className="py-20 text-center text-sm text-slate-500">
        Loading campaign…
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="space-y-3 py-16 text-center">
        <p className="text-sm text-slate-600">Campaign not found.</p>
        <Link
          href={`${prefix}/campaigns`}
          className="text-sm font-medium text-[#0c5290] hover:underline"
        >
          ← Back to campaigns
        </Link>
      </div>
    );
  }

  return (
    <div className="flex w-full min-w-0 flex-col">
      {/* Campaign chrome */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href={`${prefix}/campaigns`}
            className="shrink-0 text-sm text-slate-500 hover:text-slate-800"
          >
            ←
          </Link>
          <h1 className="truncate text-lg font-semibold tracking-tight text-slate-900 sm:text-xl">
            {campaign.name}
          </h1>
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${statusTone(campaign.status)}`}
          >
            {statusLabel(campaign.status)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`${prefix}/conversations`}
            className="px-2 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-800"
          >
            Replies
          </Link>
          {campaign.status !== "running" ? (
            <button
              type="button"
              disabled={busy || !primaryAccount}
              onClick={() =>
                void saveSettings({
                  status: "running",
                  outreach_account_id:
                    campaign.outreach_account_id || primaryAccount?.id || null,
                })
              }
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              Start
            </button>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => void saveSettings({ status: "paused" })}
              className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              Pause
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <nav
        className="mt-1 flex gap-5 border-b border-slate-200"
        aria-label="Campaign sections"
      >
        {TAB_ITEMS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`-mb-px border-b-[3px] pb-2.5 text-sm font-semibold transition-colors ${
              tab === item.id
                ? "border-sky-600 text-sky-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {error ? (
        <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </div>
      ) : null}

      {/* ——— OVERVIEW ——— */}
      {tab === "overview" ? (
        <div className="mt-6 min-h-[60vh] space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 overflow-hidden rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-[0_1px_3px_rgba(0,0,0,0.02),0_4px_12px_rgba(0,0,0,0.015)] sm:px-5">
            <div className="flex flex-wrap gap-6 sm:gap-10">
              <button
                type="button"
                onClick={() =>
                  setLeadDrawer({
                    kind: "hopper",
                    hopper: "staging",
                    title: "Staging",
                  })
                }
                className="text-left"
              >
                <span className="block text-[11px] font-medium text-slate-500">
                  Staging
                </span>
                <span className="text-2xl font-semibold tabular-nums tracking-tight text-slate-900">
                  {stagingLeads.length}
                </span>
              </button>
              <button
                type="button"
                onClick={() =>
                  setLeadDrawer({
                    kind: "hopper",
                    hopper: "active",
                    title: "In campaign",
                  })
                }
                className="text-left"
              >
                <span className="block text-[11px] font-medium text-slate-500">
                  In campaign
                </span>
                <span className="text-2xl font-semibold tabular-nums tracking-tight text-slate-900">
                  {activeLeads.length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setTab("prospects")}
                className="text-left"
              >
                <span className="block text-[11px] font-medium text-slate-500">
                  Prospects
                </span>
                <span className="text-2xl font-semibold tabular-nums tracking-tight text-slate-900">
                  {leads.length}
                </span>
              </button>
            </div>
            <button
              type="button"
              onClick={() => setAddLeadsOpen(true)}
              className="rounded-lg bg-[#0c5290] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0a457a]"
            >
              Add prospects
            </button>
          </div>

          {leads.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 px-6 py-16 text-center">
              <p className="text-sm font-medium text-slate-800">
                No prospects yet
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Add people, then check volume and reply rates here.
              </p>
              <button
                type="button"
                onClick={() => setAddLeadsOpen(true)}
                className="mt-4 text-sm font-semibold text-[#0c5290] hover:underline"
              >
                Add prospects
              </button>
            </div>
          ) : (
            <>
              <CampaignDialsPanel
                dials={buildCampaignDials({
                  leads,
                  hasInviteStep: steps.some((s) => s.step_type === "invite"),
                })}
              />

              <CampaignDailyStackChart buckets={activityBuckets} />

              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.02),0_4px_12px_rgba(0,0,0,0.015)]">
                <div className="flex items-center justify-between gap-3 border-b border-slate-600/40 bg-slate-700 px-4 py-2.5">
                  <h2 className="text-sm font-semibold tracking-wide text-white">
                    By status
                  </h2>
                  <button
                    type="button"
                    onClick={() => setTab("prospects")}
                    className="text-xs font-medium text-sky-200 hover:text-white"
                  >
                    View all
                  </button>
                </div>
                <ul className="divide-y divide-slate-100 px-1">
                  {Object.keys(statusCounts).length === 0 ? (
                    <li className="py-8 text-center text-sm text-slate-500">
                      No activity yet
                    </li>
                  ) : (
                    Object.entries(statusCounts)
                      .sort((a, b) => b[1] - a[1])
                      .map(([status, count]) => (
                        <li key={status}>
                          <button
                            type="button"
                            onClick={() =>
                              setLeadDrawer({
                                kind: "status",
                                status,
                                title: statusLabel(status),
                              })
                            }
                            className="flex w-full items-center justify-between px-3 py-3 text-sm hover:bg-slate-50"
                          >
                            <span className="font-medium text-slate-700">
                              {statusLabel(status)}
                            </span>
                            <span className="tabular-nums font-semibold text-slate-900">
                              {count}
                            </span>
                          </button>
                        </li>
                      ))
                  )}
                </ul>
              </div>

              {abStats &&
              steps.some((s) => s.id && s.variants && s.variants.length > 0) ? (
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.02),0_4px_12px_rgba(0,0,0,0.015)]">
                  <div className="border-b border-slate-600/40 bg-slate-700 px-4 py-2.5 text-sm font-semibold tracking-wide text-white">
                    A/B
                  </div>
                  <div className="space-y-4 px-4 py-4">
                    {steps
                      .filter((s) => s.id && s.variants && s.variants.length > 0)
                      .map((s) => (
                        <div key={s.id}>
                          <p className="text-xs text-slate-500">
                            {stepTypeLabel(s.step_type)}
                          </p>
                          <div className="mt-2 grid gap-3 sm:grid-cols-2">
                            {(s.variants || []).map((v) => {
                              const stats = s.id
                                ? abStats[s.id]?.[v.key]
                                : undefined;
                              return (
                                <div key={v.key} className="py-1">
                                  <p className="text-sm font-semibold text-slate-800">
                                    {v.key}
                                  </p>
                                  <p className="mt-0.5 text-xs text-slate-500">
                                    {stats
                                      ? `${stats.assigned} sent · ${stats.interested} interested`
                                      : "No sends yet"}
                                  </p>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              ) : null}
            </>
          )}
        </div>
      ) : null}

      {/* ——— PROSPECTS ——— */}
      {tab === "prospects" ? (
        <div className="mt-4 min-h-[60vh]">
          <div className="mb-4 flex items-center justify-between gap-3">
            <p className="text-sm text-slate-500">
              {leads.length} prospect{leads.length === 1 ? "" : "s"}
            </p>
            <button
              type="button"
              onClick={() => setAddLeadsOpen(true)}
              className="rounded-lg bg-[#0c5290] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0a457a]"
            >
              Add prospects
            </button>
          </div>

          {leads.length === 0 ? (
            <div className="flex min-h-[40vh] items-center justify-center rounded-2xl bg-slate-50">
              <div className="text-center">
                <p className="text-sm text-slate-500">No prospects yet</p>
                <button
                  type="button"
                  onClick={() => setAddLeadsOpen(true)}
                  className="mt-2 text-sm font-semibold text-[#0c5290] hover:underline"
                >
                  Add prospects
                </button>
              </div>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-2.5 font-semibold">Prospect</th>
                    <th className="px-4 py-2.5 font-semibold">Status</th>
                    <th className="hidden px-4 py-2.5 font-semibold sm:table-cell">
                      Company
                    </th>
                    <th className="px-4 py-2.5 text-right font-semibold">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {leads.map((lead) => (
                    <tr key={lead.id} className="hover:bg-slate-50/80">
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">
                          {leadName(lead)}
                        </div>
                        {lead.linkedin_url ? (
                          <a
                            href={lead.linkedin_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-[#0c5290] hover:underline"
                          >
                            Profile
                          </a>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {statusLabel(lead.status)}
                      </td>
                      <td className="hidden px-4 py-3 text-slate-500 sm:table-cell">
                        {lead.company || "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-3">
                          {(lead.status === "replied" ||
                            lead.status === "in_sequence" ||
                            lead.status === "connected") &&
                          !lead.interest_outcome ? (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                void markLeadInterest(lead.id, "positive")
                              }
                              className="text-xs font-medium text-emerald-700 hover:underline"
                            >
                              Interested
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => void deleteLead(lead.id)}
                            className="text-xs font-medium text-slate-400 hover:text-rose-600"
                          >
                            Remove
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}

      {/* ——— STEPS ——— */}
      {tab === "steps" ? (
        <div className="mt-4 min-h-[60vh]">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-500">
              {steps.length === 0
                ? "Build the sequence people move through"
                : `${steps.length} step${steps.length === 1 ? "" : "s"} · ${activeLeads.length} in campaign`}
            </p>
            <button
              type="button"
              onClick={() => setTab("prospects")}
              className="text-xs font-medium text-[#0c5290] hover:underline"
            >
              Manage prospects
            </button>
          </div>

          {steps.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 px-6 py-16 text-center">
              <p className="text-sm text-slate-500">No steps yet</p>
              <button
                type="button"
                onClick={() => addStep("invite")}
                className="mt-3 text-sm font-semibold text-[#0c5290] hover:underline"
              >
                Add connection request
              </button>
            </div>
          ) : (
            <ol className="space-y-2">
              {steps.map((step, idx) => {
                const count = countAtStep(step, idx);
                const hasAb = Boolean(
                  step.variants && step.variants.length > 0
                );
                const isWait = step.step_type === "wait";
                return (
                  <li key={step.id || `${step.step_type}-${idx}`}>
                    {hasAb && step.step_type === "message" ? (
                      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold tabular-nums text-slate-600">
                              {idx + 1}
                            </span>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-900">
                                Message
                                {step.send_mode === "remind" ? (
                                  <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                                    Remind me
                                  </span>
                                ) : null}
                              </p>
                            </div>
                          </div>
                          {count > 0 ? (
                            <button
                              type="button"
                              onClick={() =>
                                setLeadDrawer({
                                  kind: "step",
                                  position: step.position ?? idx,
                                  title: stepTypeLabel(step.step_type),
                                })
                              }
                              className="shrink-0 rounded-full bg-slate-50 px-2.5 py-1 text-xs font-semibold tabular-nums text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100"
                            >
                              {count}
                            </button>
                          ) : null}
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {(step.variants || []).slice(0, 2).map((v) => (
                            <button
                              key={v.key}
                              type="button"
                              onClick={() => setEditingStepIndex(idx)}
                              className="rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2.5 text-left transition hover:border-slate-300 hover:bg-white"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-xs font-semibold text-slate-800">
                                  {v.key}
                                </span>
                                {step.id && abStats?.[step.id]?.[v.key] ? (
                                  <span className="text-[10px] tabular-nums text-slate-400">
                                    {abStats[step.id][v.key].assigned}
                                  </span>
                                ) : null}
                              </div>
                              <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-slate-500">
                                {v.body || "Empty"}
                              </p>
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div
                        className={`flex items-stretch gap-0 overflow-hidden rounded-xl border ${
                          isWait
                            ? "border-dashed border-slate-200 bg-slate-50/60"
                            : "border-slate-200 bg-white"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => setEditingStepIndex(idx)}
                          className="flex min-w-0 flex-1 items-start gap-3 px-4 py-3.5 text-left transition hover:bg-slate-50/80"
                        >
                          <span
                            className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums ${
                              isWait
                                ? "bg-white text-slate-500 ring-1 ring-slate-200"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {idx + 1}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p
                              className={`text-sm font-semibold ${
                                isWait ? "text-slate-600" : "text-slate-900"
                              }`}
                            >
                              {isWait
                                ? `Wait ${formatWait(step.wait_hours)}`
                                : stepTypeLabel(step.step_type)}
                              {step.step_type === "message" &&
                              step.send_mode === "remind" ? (
                                <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                                  Remind me
                                </span>
                              ) : null}
                            </p>
                            {!isWait &&
                            step.step_type !== "react" &&
                            step.body ? (
                              <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500">
                                {step.body}
                              </p>
                            ) : null}
                          </div>
                        </button>
                        {count > 0 ? (
                          <button
                            type="button"
                            onClick={() =>
                              setLeadDrawer({
                                kind: "step",
                                position: step.position ?? idx,
                                title: stepTypeLabel(step.step_type),
                              })
                            }
                            className="shrink-0 border-l border-slate-100 px-3 text-xs font-semibold tabular-nums text-slate-700 hover:bg-slate-50"
                          >
                            {count}
                          </button>
                        ) : (
                          <span className="w-3 shrink-0" aria-hidden />
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          )}

          <div className="relative mt-4">
            <button
              type="button"
              onClick={() => setAddStepOpen((o) => !o)}
              className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-2.5 text-xs font-medium text-slate-600 hover:border-slate-400 hover:text-slate-900"
            >
              Add step
            </button>
            {addStepOpen ? (
              <div className="absolute left-0 z-20 mt-2 w-48 rounded-xl border border-slate-200 bg-white py-1 shadow-lg shadow-slate-900/10">
                {(
                  [
                    ["invite", "Connection"],
                    ["message", "Message"],
                    ["wait", "Wait"],
                    ["react", "Like post"],
                    ["comment", "Comment"],
                  ] as const
                ).map(([type, label]) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => addStep(type)}
                    className="block w-full px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    {label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* ——— SETTINGS ——— */}
      {tab === "settings" ? (
        <div className="mt-4 min-h-[60vh] max-w-lg space-y-6">
          <label className="block text-sm font-medium text-slate-700">
            Name
            <input
              value={campaign.name}
              onChange={(e) =>
                setCampaign({ ...campaign, name: e.target.value })
              }
              onBlur={() => void saveSettings({ name: campaign.name })}
              className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Daily invite limit
            <input
              type="number"
              min={1}
              max={50}
              value={campaign.daily_invite_limit}
              onChange={(e) =>
                setCampaign({
                  ...campaign,
                  daily_invite_limit: Number(e.target.value || 20),
                })
              }
              onBlur={() =>
                void saveSettings({
                  daily_invite_limit: campaign.daily_invite_limit,
                })
              }
              className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Min delay between actions (seconds)
            <input
              type="number"
              min={60}
              value={campaign.min_action_delay_seconds}
              onChange={(e) =>
                setCampaign({
                  ...campaign,
                  min_action_delay_seconds: Number(e.target.value || 180),
                })
              }
              onBlur={() =>
                void saveSettings({
                  min_action_delay_seconds: campaign.min_action_delay_seconds,
                })
              }
              className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
            />
          </label>

          {playbooks.length ? (
            <div>
              <p className="text-sm font-medium text-slate-700">Playbook</p>
              <p className="mt-0.5 text-xs text-slate-500">
                Replaces the current sequence
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {playbooks.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    disabled={busy}
                    title={p.description}
                    onClick={() => void applyPlaybook(p.id)}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="border-t border-slate-200 pt-4">
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (!window.confirm("Archive this campaign?")) return;
                void saveSettings({ status: "archived" }).then(() =>
                  router.push(`${prefix}/campaigns`)
                );
              }}
              className="text-sm font-medium text-rose-600 hover:underline disabled:opacity-50"
            >
              Archive campaign
            </button>
          </div>
        </div>
      ) : null}

      {/* Step editor */}
      {editingStep && editingStepIndex !== null ? (
        <div className="fixed inset-0 z-[100] flex justify-end">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/30"
            aria-label="Close"
            onClick={() => setEditingStepIndex(null)}
          />
          <aside
            role="dialog"
            aria-modal="true"
            aria-labelledby="step-editor-title"
            className="relative flex h-full w-full max-w-md flex-col bg-white shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <h2
                id="step-editor-title"
                className="text-sm font-semibold text-slate-900"
              >
                {stepTypeLabel(editingStep.step_type)}
              </h2>
              <button
                type="button"
                onClick={() => setEditingStepIndex(null)}
                className="text-sm text-slate-500 hover:text-slate-800"
              >
                Close
              </button>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
              <label className="block text-sm font-medium text-slate-700">
                Type
                <select
                  value={editingStep.step_type}
                  onChange={(e) =>
                    updateEditingStep({
                      step_type: e.target.value as Step["step_type"],
                    })
                  }
                  className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm"
                >
                  <option value="invite">Connection request</option>
                  <option value="react">Like post</option>
                  <option value="comment">Comment</option>
                  <option value="message">Message</option>
                  <option value="wait">Wait</option>
                </select>
              </label>

              {editingStep.step_type === "wait" ? (
                <label className="block text-sm font-medium text-slate-700">
                  Hours
                  <input
                    type="number"
                    min={0.1}
                    step={0.5}
                    value={editingStep.wait_hours ?? 24}
                    onChange={(e) =>
                      updateEditingStep({
                        wait_hours: Number(e.target.value || 24),
                      })
                    }
                    className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
                  />
                </label>
              ) : null}

              {editingStep.step_type === "react" ? (
                <p className="text-sm text-slate-500">
                  Likes their most recent post. Nothing to edit.
                </p>
              ) : null}

              {editingStep.step_type === "message" ||
              editingStep.step_type === "comment" ||
              editingStep.step_type === "invite" ? (
                <>
                  {editingStep.step_type === "message" ? (
                    <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/80 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-slate-800">
                            Send mode
                          </p>
                          <p className="mt-0.5 text-[11px] text-slate-500">
                            Auto sends via worker. Remind me queues for you —
                            optional fallback if you miss it.
                          </p>
                        </div>
                        <select
                          value={editingStep.send_mode === "remind" ? "remind" : "auto"}
                          onChange={(e) =>
                            updateEditingStep({
                              send_mode: e.target.value as "auto" | "remind",
                              ...(e.target.value === "auto"
                                ? {
                                    fallback_hours: null,
                                    fallback_body: null,
                                  }
                                : {}),
                            })
                          }
                          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium"
                        >
                          <option value="auto">Auto</option>
                          <option value="remind">Remind me</option>
                        </select>
                      </div>
                      {editingStep.send_mode === "remind" ? (
                        <div className="space-y-3 border-t border-slate-200/80 pt-3">
                          <label className="block text-xs font-medium text-slate-700">
                            Fallback after (hours)
                            <input
                              type="number"
                              min={1}
                              max={720}
                              placeholder="Off"
                              value={editingStep.fallback_hours ?? ""}
                              onChange={(e) =>
                                updateEditingStep({
                                  fallback_hours: e.target.value
                                    ? Number(e.target.value)
                                    : null,
                                })
                              }
                              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-normal"
                            />
                            <span className="mt-1 block text-[11px] font-normal text-slate-500">
                              Leave blank for no auto-send. After this many hours
                              past due, the fallback template goes out.
                            </span>
                          </label>
                          {editingStep.fallback_hours != null ? (
                            <label className="block text-xs font-medium text-slate-700">
                              Fallback message
                              <textarea
                                value={editingStep.fallback_body ?? ""}
                                onChange={(e) =>
                                  updateEditingStep({
                                    fallback_body: e.target.value,
                                  })
                                }
                                rows={3}
                                placeholder="Uses the main message template if empty"
                                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-normal"
                              />
                            </label>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  {editingStep.step_type === "message" ? (
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-700">
                        A/B test
                      </span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={Boolean(
                          editingStep.variants &&
                            editingStep.variants.length > 0
                        )}
                        onClick={() => {
                          if (
                            editingStep.variants &&
                            editingStep.variants.length > 0
                          ) {
                            disableAbOnEditingStep();
                          } else {
                            enableAbOnEditingStep();
                          }
                        }}
                        className={`relative h-6 w-11 rounded-full transition ${
                          editingStep.variants &&
                          editingStep.variants.length > 0
                            ? "bg-[#0c5290]"
                            : "bg-slate-200"
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
                            editingStep.variants &&
                            editingStep.variants.length > 0
                              ? "translate-x-5"
                              : ""
                          }`}
                        />
                      </button>
                    </div>
                  ) : null}

                  {editingStep.variants && editingStep.variants.length > 0 ? (
                    <div className="space-y-4">
                      {editingStep.variants.map((v, vi) => (
                        <label
                          key={v.key}
                          className="block text-sm font-medium text-slate-700"
                        >
                          Variant {v.key}
                          <textarea
                            value={v.body}
                            onChange={(e) => {
                              const variants = [
                                ...(editingStep.variants || []),
                              ];
                              variants[vi] = { ...v, body: e.target.value };
                              updateEditingStep({
                                variants,
                                body: variants[0]?.body || e.target.value,
                              });
                            }}
                            rows={4}
                            className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal"
                          />
                        </label>
                      ))}
                    </div>
                  ) : (
                    <label className="block text-sm font-medium text-slate-700">
                      Message
                      <textarea
                        value={editingStep.body ?? ""}
                        onChange={(e) =>
                          updateEditingStep({ body: e.target.value })
                        }
                        rows={5}
                        placeholder="Hi {{first_name}}…"
                        className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal"
                      />
                    </label>
                  )}
                </>
              ) : null}
            </div>

            <div className="flex items-center gap-3 border-t border-slate-200 px-5 py-4">
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void saveSteps().then(() => setEditingStepIndex(null))
                }
                className="rounded-lg bg-[#0c5290] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#0a457a] disabled:opacity-50"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => {
                  const next = steps.filter((_, i) => i !== editingStepIndex);
                  setSteps(next);
                  setEditingStepIndex(null);
                  void saveSteps(next);
                }}
                className="text-xs font-medium text-rose-600 hover:underline"
              >
                Delete
              </button>
            </div>
          </aside>
        </div>
      ) : null}

      {/* Lead drawer */}
      {leadDrawer ? (
        <div className="fixed inset-0 z-[100] flex justify-end">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/30"
            aria-label="Close"
            onClick={() => setLeadDrawer(null)}
          />
          <aside
            role="dialog"
            aria-modal="true"
            className="relative flex h-full w-full max-w-md flex-col bg-white shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  {leadDrawer.title}
                </h2>
                <p className="text-xs text-slate-500">
                  {drawerLeads.length} people
                </p>
              </div>
              <button
                type="button"
                onClick={() => setLeadDrawer(null)}
                className="text-sm text-slate-500 hover:text-slate-800"
              >
                Close
              </button>
            </div>
            <ul className="flex-1 divide-y divide-slate-100 overflow-y-auto">
              {drawerLeads.length === 0 ? (
                <li className="px-5 py-12 text-center text-sm text-slate-500">
                  Nobody here yet
                </li>
              ) : (
                drawerLeads.map((lead) => (
                  <li key={lead.id} className="px-5 py-3">
                    <div className="text-sm font-medium text-slate-900">
                      {leadName(lead)}
                    </div>
                    <div className="text-xs text-slate-500">
                      {statusLabel(lead.status)}
                      {lead.company ? ` · ${lead.company}` : ""}
                    </div>
                  </li>
                ))
              )}
            </ul>
          </aside>
        </div>
      ) : null}

      {/* Add prospects */}
      {addLeadsOpen ? (
        <div className="fixed inset-0 z-[110] flex items-end justify-center bg-slate-900/40 p-4 sm:items-center">
          <button
            type="button"
            className="absolute inset-0"
            aria-label="Close"
            onClick={() => setAddLeadsOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            className="relative w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">
                Add prospects
              </h2>
              <button
                type="button"
                onClick={() => setAddLeadsOpen(false)}
                className="text-sm text-slate-500 hover:text-slate-800"
              >
                Close
              </button>
            </div>

            <div className="mt-4 flex gap-4 border-b border-slate-200 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setAudienceMode("search")}
                className={`pb-2 ${
                  audienceMode === "search"
                    ? "border-b-2 border-[#0c5290] text-[#0c5290]"
                    : "text-slate-400"
                }`}
              >
                Search
              </button>
              <button
                type="button"
                onClick={() => setAudienceMode("urls")}
                className={`pb-2 ${
                  audienceMode === "urls"
                    ? "border-b-2 border-[#0c5290] text-[#0c5290]"
                    : "text-slate-400"
                }`}
              >
                Paste URLs
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {audienceMode === "search" ? (
                <>
                  <input
                    value={searchUrl}
                    onChange={(e) => setSearchUrl(e.target.value)}
                    placeholder="Sales Nav or LinkedIn search URL"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
                  />
                  <input
                    value={searchKeywords}
                    onChange={(e) => setSearchKeywords(e.target.value)}
                    placeholder="Or keywords…"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={
                        busy || (!searchUrl.trim() && !searchKeywords.trim())
                      }
                      onClick={() => void runLinkedInSearch(null)}
                      className="rounded-lg bg-[#0c5290] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                    >
                      Search
                    </button>
                    {searchCursor ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void runLinkedInSearch(searchCursor)}
                        className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium"
                      >
                        Next page
                      </button>
                    ) : null}
                    {searchHits.length ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          void importLeadsFromPayload(
                            searchHits
                              .filter((h) => h.linkedin_url)
                              .map((h) => ({
                                linkedin_url: h.linkedin_url,
                                first_name: h.first_name,
                                last_name: h.last_name,
                                company: h.company,
                                title: h.title,
                                linkedin_provider_id: h.linkedin_provider_id,
                              }))
                          )
                        }
                        className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium"
                      >
                        Add {searchHits.filter((h) => h.linkedin_url).length}
                      </button>
                    ) : null}
                  </div>
                  {searchHits.length ? (
                    <ul className="max-h-48 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200">
                      {searchHits.map((h, i) => (
                        <li
                          key={`${h.linkedin_url}-${i}`}
                          className="px-3 py-2"
                        >
                          <div className="truncate text-sm font-medium">
                            {[h.first_name, h.last_name]
                              .filter(Boolean)
                              .join(" ") ||
                              h.linkedin_url ||
                              "Unknown"}
                          </div>
                          <div className="truncate text-xs text-slate-500">
                            {[h.title, h.company].filter(Boolean).join(" · ")}
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </>
              ) : (
                <>
                  <textarea
                    value={importText}
                    onChange={(e) => setImportText(e.target.value)}
                    rows={6}
                    placeholder="One LinkedIn URL per line"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
                  />
                  <button
                    type="button"
                    disabled={busy || !importText.trim()}
                    onClick={() => void importLeads()}
                    className="rounded-lg bg-[#0c5290] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    Add to staging
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
