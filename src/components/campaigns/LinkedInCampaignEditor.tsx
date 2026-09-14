"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { getCoachAuthHeaders } from "@/lib/coachAuthHeaders";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import type { CampaignActivityDay } from "@/components/campaigns/CampaignOverviewMetrics";
import {
  buildCampaignDials,
  buildCampaignFuel,
  CampaignDailyStackChart,
  CampaignDialsPanel,
  CampaignFuelPanel,
} from "@/components/campaigns/CampaignOverviewMetrics";
import { CampaignOnOffToggle } from "@/components/campaigns/CampaignOnOffToggle";
import { CampaignSequenceBuilder } from "@/components/campaigns/CampaignSequenceBuilder";
import { CampaignProspectsActivityTable } from "@/components/campaigns/CampaignProspectsActivityTable";
import { CampaignAddProspectsModal } from "@/components/campaigns/CampaignAddProspectsModal";
import { CampaignSettingsForm } from "@/components/campaigns/CampaignSettingsForm";
import { PageHeaderUnderlineTabs } from "@/components/layout/PageHeaderUnderlineTabs";
import {
  campaignStepHasCopy,
  defaultStepConfig,
  type CampaignStepType,
} from "@/lib/unipile/campaignStepTypes";
import {
  isMailingProvider,
  type UnipileConnectProvider,
} from "@/lib/unipile/providers";
import {
  leadStatusLabel as activityLeadStatusLabel,
  type CampaignActivityJob,
} from "@/lib/unipile/campaignLeadActivity";
import type { AbVariantStats } from "@/lib/unipile/abMetrics";
import {
  magnetForPlaybookId,
} from "@/lib/leadMagnets/catalog";

type Account = {
  id: string;
  status: string;
  display_name: string | null;
  provider?: string;
};

type Campaign = {
  id: string;
  name: string;
  status: string;
  channel?: string;
  source_playbook_id?: string | null;
  daily_invite_limit: number;
  daily_message_limit?: number | null;
  daily_react_limit?: number | null;
  min_action_delay_seconds: number;
  outreach_account_id: string | null;
  outreach_priority?: number | null;
  outreach_weight?: number | null;
  timezone?: string | null;
  send_rules?: unknown;
  stop_on_reply?: boolean | null;
};

type Step = {
  id?: string;
  position: number;
  step_type: CampaignStepType;
  body: string | null;
  wait_hours: number | null;
  variants?: Array<{ key: string; label?: string; body: string }> | null;
  send_mode?: "auto" | "remind" | null;
  fallback_hours?: number | null;
  fallback_body?: string | null;
  config?: Record<string, unknown> | null;
};

type Lead = {
  id: string;
  contact_id?: string | null;
  linkedin_url: string | null;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  title?: string | null;
  status: string;
  interest_outcome?: string | null;
  last_error: string | null;
  current_step_position?: number;
  next_action_at?: string | null;
};

type TabId = "overview" | "prospects" | "steps" | "settings";

type LeadDrawerFilter =
  | { kind: "status"; status: string; title: string }
  | { kind: "step"; position: number; title: string }
  | { kind: "hopper"; hopper: "staging" | "active"; title: string };

async function authHeaders(impersonatingCoachId?: string | null) {
  return getCoachAuthHeaders(impersonatingCoachId);
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
  const { impersonatingCoachId } = useImpersonation();

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [jobs, setJobs] = useState<CampaignActivityJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>("overview");
  const [abStats, setAbStats] = useState<Record<
    string,
    Record<string, AbVariantStats>
  > | null>(null);
  const [activityBuckets, setActivityBuckets] = useState<CampaignActivityDay[]>(
    []
  );
  const [leadDrawer, setLeadDrawer] = useState<LeadDrawerFilter | null>(null);
  const [addLeadsOpen, setAddLeadsOpen] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [connectingProvider, setConnectingProvider] = useState<string | null>(
    null
  );
  const [otherCampaigns, setOtherCampaigns] = useState<
    Array<{ id: string; name: string }>
  >([]);

  useEffect(() => {
    if (!editingName) return;
    nameInputRef.current?.focus();
    nameInputRef.current?.select();
  }, [editingName]);

  const primaryAccount = accounts[0] ?? null;
  const mailingAccount =
    accounts.find(
      (account) =>
        account.status === "OK" && isMailingProvider(account.provider ?? "")
    ) ?? null;
  const canStart =
    campaign?.channel === "email"
      ? Boolean(mailingAccount)
      : Boolean(primaryAccount);
  const stepsRef = useRef(steps);
  stepsRef.current = steps;

  const load = useCallback(async () => {
    const headers = await authHeaders(impersonatingCoachId);
    if (!headers || !campaignId) return;
    const [accRes, detailRes, listRes] = await Promise.all([
      fetch("/api/coach/linkedin-outreach/accounts", { headers }),
      fetch(
        `/api/coach/linkedin-outreach/campaigns/${encodeURIComponent(campaignId)}`,
        { headers }
      ),
      fetch("/api/coach/linkedin-outreach/campaigns", { headers }),
    ]);
    const accBody = await accRes.json().catch(() => ({}));
    const detail = await detailRes.json().catch(() => ({}));
    if (!accRes.ok) throw new Error(accBody.error || "Accounts failed.");
    if (!detailRes.ok) throw new Error(detail.error || "Campaign not found.");
    setAccounts(accBody.accounts ?? []);
    setCampaign(detail.campaign);
    setSteps(detail.steps ?? []);
    setLeads(detail.leads ?? []);
    setJobs(detail.jobs ?? []);
    setAbStats(detail.ab?.stats ?? null);
    setActivityBuckets(detail.activity?.buckets ?? []);
    const listBody = await listRes.json().catch(() => ({}));
    if (listRes.ok) {
      const listed = (listBody.campaigns ?? []) as Array<{
        id: string;
        name: string;
      }>;
      setOtherCampaigns(
        listed
          .filter((row) => row.id !== campaignId)
          .map((row) => ({ id: row.id, name: row.name }))
      );
    }
  }, [campaignId, impersonatingCoachId]);

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

  useEffect(() => {
    if (!campaign?.source_playbook_id) return;
    const magnet = magnetForPlaybookId(campaign.source_playbook_id);
    if (!magnet) return;
    router.replace(`${prefix}/campaigns/magnets/${magnet.id}`);
  }, [campaign, prefix, router]);

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

  async function saveSettings(patch: Record<string, unknown>) {
    if (!campaignId) return;
    setBusy(true);
    setError(null);
    try {
      const headers = await authHeaders(impersonatingCoachId);
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
      const headers = await authHeaders(impersonatingCoachId);
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

  async function markLeadInterest(leadId: string, outcome: string) {
    setBusy(true);
    try {
      const headers = await authHeaders(impersonatingCoachId);
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

  async function deleteLead(leadId: string) {
    if (!campaignId) return;
    setBusy(true);
    try {
      const headers = await authHeaders(impersonatingCoachId);
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

  function addStep(type: Step["step_type"], atIndex?: number) {
    const insertAt = Math.max(0, Math.min(atIndex ?? steps.length, steps.length));
    const created: Step = {
      position: insertAt,
      step_type: type,
      body: campaignStepHasCopy(type) ? "" : null,
      wait_hours: type === "wait" ? 24 : null,
      send_mode: type === "message" ? "auto" : "auto",
      fallback_hours: null,
      fallback_body: null,
      config: defaultStepConfig(type),
    };
    const next = [...steps.slice(0, insertAt), created, ...steps.slice(insertAt)].map(
      (s, i) => ({ ...s, position: i })
    );
    setSteps(next);
    void saveSteps(next);
  }

  function patchStep(index: number, patch: Partial<Step>) {
    const next = stepsRef.current.map((s, i) =>
      i === index ? { ...s, ...patch } : s
    );
    stepsRef.current = next;
    setSteps(next);
  }

  function commitSteps() {
    void saveSteps(stepsRef.current);
  }

  function deleteStep(index: number) {
    const next = steps
      .filter((_, i) => i !== index)
      .map((s, i) => ({ ...s, position: i }));
    setSteps(next);
    void saveSteps(next);
  }

  async function connectProvider(provider: UnipileConnectProvider) {
    setConnectingProvider(provider);
    setError(null);
    try {
      const headers = await authHeaders(impersonatingCoachId);
      if (!headers) throw new Error("Sign in required.");
      const res = await fetch("/api/coach/linkedin-outreach/accounts", {
        method: "POST",
        headers,
        body: JSON.stringify({ provider, return_to: "campaigns" }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.url) {
        throw new Error(body.error || "Could not start connect.");
      }
      window.location.href = body.url as string;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connect failed.");
      setConnectingProvider(null);
    }
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

  const magnetHome = magnetForPlaybookId(campaign.source_playbook_id);
  if (magnetHome) {
    return (
      <div className="py-20 text-center text-sm text-slate-500">
        Opening {magnetHome.title}…
      </div>
    );
  }

  const activeCampaign = campaign;
  const hasInviteStep = steps.some((s) => s.step_type === "invite");
  const running = activeCampaign.status === "running";

  function startEditingName() {
    setNameDraft(activeCampaign.name);
    setEditingName(true);
  }

  async function commitNameEdit() {
    const next = nameDraft.trim();
    setEditingName(false);
    if (!next || next === activeCampaign.name) {
      setNameDraft(activeCampaign.name);
      return;
    }
    setCampaign({ ...activeCampaign, name: next });
    await saveSettings({ name: next });
  }

  function toggleRunning() {
    if (activeCampaign.status === "running") {
      void saveSettings({ status: "paused" });
      return;
    }
    void saveSettings({
      status: "running",
      outreach_account_id:
        activeCampaign.channel === "email"
          ? activeCampaign.outreach_account_id || mailingAccount?.id || null
          : activeCampaign.outreach_account_id || primaryAccount?.id || null,
    });
  }

  return (
    <div className="flex w-full min-w-0 flex-col">
      {/* Campaign chrome */}
      <div className="pt-3 pb-1">
        <Link
          href={`${prefix}/campaigns`}
          className="inline-flex items-center text-sm text-slate-500 hover:text-slate-800"
        >
          ← Campaigns
        </Link>
        <div className="mt-2 flex min-w-0 items-center gap-3">
          <CampaignOnOffToggle
            on={running}
            busy={busy}
            disabled={!running && !canStart}
            onChange={toggleRunning}
            ariaLabel={running ? "Turn campaign off" : "Turn campaign on"}
          />
          {editingName ? (
            <input
              ref={nameInputRef}
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onBlur={() => void commitNameEdit()}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void commitNameEdit();
                }
                if (e.key === "Escape") {
                  e.preventDefault();
                  setEditingName(false);
                  setNameDraft(campaign.name);
                }
              }}
              aria-label="Campaign name"
              className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-lg font-semibold tracking-tight text-slate-900 outline-none ring-emerald-700/30 focus:ring-2 sm:text-xl"
            />
          ) : (
            <>
              <h1 className="min-w-0 truncate text-lg font-semibold tracking-tight text-slate-900 sm:text-xl">
                {campaign.name}
              </h1>
              <button
                type="button"
                onClick={startEditingName}
                aria-label="Edit campaign name"
                className="shrink-0 rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <Pencil className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
              </button>
            </>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-end justify-between gap-x-4 gap-y-2 border-b border-slate-200">
        <PageHeaderUnderlineTabs
          ariaLabel="Campaign sections"
          className="min-w-0 flex-1"
          items={TAB_ITEMS.map((item) => ({
            kind: "button" as const,
            id: item.id,
            label: item.label,
            active: tab === item.id,
            onClick: () => setTab(item.id),
          }))}
        />
        <Link
          href={`${prefix}/conversations?campaign=${encodeURIComponent(campaign.id)}`}
          className="mb-1.5 inline-flex shrink-0 items-center rounded-lg bg-[#0c5290] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0a4578]"
        >
          View replies
        </Link>
      </div>

      {error ? (
        <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </div>
      ) : null}

      {/* ——— OVERVIEW ——— */}
      {tab === "overview" ? (
        <div className="mt-6 min-h-[60vh] space-y-6">
          {leads.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 px-6 py-16 text-center">
              <p className="text-sm font-medium text-slate-800">
                No prospects yet
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Add people so this campaign has a queue to work through.
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
              <div className="grid gap-6 lg:grid-cols-2 lg:items-stretch">
                <CampaignFuelPanel
                  fuel={buildCampaignFuel({
                    leads,
                    dailyLimit: campaign.daily_invite_limit,
                    campaignStatus: campaign.status,
                    hasInviteStep,
                  })}
                  onAddProspects={() => setAddLeadsOpen(true)}
                  onOpenQueued={() =>
                    setLeadDrawer({
                      kind: "hopper",
                      hopper: "staging",
                      title: hasInviteStep ? "Left to invite" : "Left to start",
                    })
                  }
                  onOpenFollowUp={() =>
                    setLeadDrawer({
                      kind: "hopper",
                      hopper: "active",
                      title: hasInviteStep ? "In follow-up" : "In sequence",
                    })
                  }
                />
                <CampaignDialsPanel
                  dials={buildCampaignDials({
                    leads,
                    hasInviteStep,
                  })}
                />
              </div>

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
                                title: activityLeadStatusLabel(status),
                              })
                            }
                            className="flex w-full items-center justify-between px-3 py-3 text-sm hover:bg-slate-50"
                          >
                            <span className="font-medium text-slate-700">
                              {activityLeadStatusLabel(status)}
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
            </>
          )}
        </div>
      ) : null}

      {/* ——— PROSPECTS ——— */}
      {tab === "prospects" ? (
        <div className="mt-4">
          <CampaignProspectsActivityTable
            leads={leads}
            steps={steps}
            jobs={jobs}
            campaignStatus={campaign.status}
            busy={busy}
            onAdd={() => setAddLeadsOpen(true)}
            onDelete={(leadId) => void deleteLead(leadId)}
            onMarkInterest={(leadId) => void markLeadInterest(leadId, "positive")}
          />
        </div>
      ) : null}

      {/* ——— STEPS ——— */}
      {tab === "steps" ? (
        <CampaignSequenceBuilder
          steps={steps}
          countAtStep={countAtStep}
          abStats={abStats}
          accounts={accounts}
          connectingProvider={connectingProvider}
          onAddStep={addStep}
          onConnect={(provider) => void connectProvider(provider)}
          onPatchStep={patchStep}
          onCommitSteps={commitSteps}
          onDeleteStep={deleteStep}
          onOpenLeads={setLeadDrawer}
          campaigns={otherCampaigns}
        />
      ) : null}

      {/* ——— SETTINGS ——— */}
      {tab === "settings" ? (
        <CampaignSettingsForm
          key={campaign.id}
          campaign={campaign}
          busy={busy}
          onCampaignChange={(patch) =>
            setCampaign({ ...campaign, ...patch })
          }
          onSave={(patch) => void saveSettings(patch)}
          onArchive={() => {
            if (!window.confirm("Archive this campaign?")) return;
            void saveSettings({ status: "archived" }).then(() =>
              router.push(`${prefix}/campaigns`)
            );
          }}
        />
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
                      {activityLeadStatusLabel(lead.status)}
                      {lead.company ? ` · ${lead.company}` : ""}
                    </div>
                  </li>
                ))
              )}
            </ul>
          </aside>
        </div>
      ) : null}

      <CampaignAddProspectsModal
        open={addLeadsOpen}
        campaignId={campaignId}
        campaignChannel={campaign?.channel}
        existingContactIds={leads
          .map((lead) => lead.contact_id)
          .filter((id): id is string => Boolean(id))}
        existingLinkedInUrls={leads
          .map((lead) => lead.linkedin_url)
          .filter((url): url is string => Boolean(url))}
        onClose={() => setAddLeadsOpen(false)}
        onAdded={load}
      />
    </div>
  );
}
