"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { ChevronRight, Pencil, SlidersHorizontal } from "lucide-react";
import { prospectDetailHref } from "@/lib/prospects/prospectDetailHref";
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
import { PageHeaderUnderlineTabs } from "@/components/layout/PageHeaderUnderlineTabs";
import { fetchHubQuery, invalidateHubQuery, peekHubQuery } from "@/lib/getClients/hubQueryCache";
import { hubQueryKey } from "@/lib/getClients/hubKeys";
import {
  campaignCoreQueryKey,
  campaignExtrasQueryKey,
  loadCampaignCorePayload,
  loadCampaignExtrasPayload,
  type CampaignDetailCorePayload,
  type CampaignDetailExtrasPayload,
  type CampaignsHubPayload,
} from "@/lib/getClients/hubFetchers";
import type { AbVariantStats } from "@/lib/unipile/abMetrics";
import {
  campaignNewStepSendFields,
  campaignStepHasCopy,
  defaultStepConfig,
  parseManualFallbackHours,
  sequenceMessageSendMode,
  type CampaignStepMediaKind,
  type CampaignStepType,
} from "@/lib/unipile/campaignStepTypes";
import { duplicateCampaignStep } from "@/lib/unipile/campaignStepDuplicate";
import {
  isMailingProvider,
  type UnipileConnectProvider,
} from "@/lib/unipile/providers";
import {
  inviteFunnelCounts,
  inviteFunnelSliceForLead,
  leadIsHeldBeforeAction,
  leadIsHeldByWait,
  formatUpcomingWhen,
  leadStatusLabel as activityLeadStatusLabel,
  type CampaignActivityJob,
  type InviteFunnelSlice,
} from "@/lib/unipile/campaignLeadActivity";
import { magnetForPlaybookId } from "@/lib/leadMagnets/catalog";
import { mergeFieldPickerForPlaybook } from "@/lib/unipile/mergeFields";
import { CampaignAudienceEmpty } from "@/components/campaigns/CampaignAudienceEmpty";
import { CampaignTemplatePickerModal } from "@/components/campaigns/CampaignTemplatePicker";
import type { CampaignAddProspectsMode } from "@/lib/campaigns/addProspectsMode";

const CampaignSequenceBuilder = dynamic(() =>
  import("@/components/campaigns/CampaignSequenceBuilder").then((m) => ({
    default: m.CampaignSequenceBuilder,
  }))
);
const CampaignProspectsActivityTable = dynamic(() =>
  import("@/components/campaigns/CampaignProspectsActivityTable").then((m) => ({
    default: m.CampaignProspectsActivityTable,
  }))
);
const CampaignAddProspectsModal = dynamic(() =>
  import("@/components/campaigns/CampaignAddProspectsModal").then((m) => ({
    default: m.CampaignAddProspectsModal,
  }))
);
const CampaignSettingsModal = dynamic(() =>
  import("@/components/campaigns/CampaignSettingsForm").then((m) => ({
    default: m.CampaignSettingsModal,
  }))
);

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
  manual_fallback_hours?: number | null;
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
  created_at?: string | null;
};

type TabId = "overview" | "prospects" | "steps";

type LeadDrawerFilter =
  | { kind: "status"; status: string; title: string }
  | { kind: "step"; position: number; title: string }
  | { kind: "wait"; position: number; title: string }
  | {
      kind: "invite";
      slice: InviteFunnelSlice;
      position: number;
      title: string;
    }
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
];

function asCampaign(row: unknown): Campaign | null {
  if (!row || typeof row !== "object") return null;
  const c = row as Record<string, unknown>;
  if (typeof c.id !== "string") return null;
  return {
    id: c.id,
    name: typeof c.name === "string" ? c.name : "Untitled campaign",
    status: typeof c.status === "string" ? c.status : "draft",
    channel: typeof c.channel === "string" ? c.channel : undefined,
    source_playbook_id:
      typeof c.source_playbook_id === "string" ? c.source_playbook_id : null,
    daily_invite_limit:
      typeof c.daily_invite_limit === "number" ? c.daily_invite_limit : 20,
    daily_message_limit:
      typeof c.daily_message_limit === "number" ? c.daily_message_limit : null,
    daily_react_limit:
      typeof c.daily_react_limit === "number" ? c.daily_react_limit : null,
    min_action_delay_seconds:
      typeof c.min_action_delay_seconds === "number"
        ? c.min_action_delay_seconds
        : 0,
    outreach_account_id:
      typeof c.outreach_account_id === "string" ? c.outreach_account_id : null,
    outreach_priority:
      typeof c.outreach_priority === "number" ? c.outreach_priority : null,
    outreach_weight:
      typeof c.outreach_weight === "number" ? c.outreach_weight : null,
    timezone: typeof c.timezone === "string" ? c.timezone : null,
    send_rules: c.send_rules,
    stop_on_reply: typeof c.stop_on_reply === "boolean" ? c.stop_on_reply : null,
    manual_fallback_hours: parseManualFallbackHours(c.manual_fallback_hours),
  };
}

function asSteps(value: unknown): Step[] {
  return Array.isArray(value) ? (value as Step[]) : [];
}

function asLeads(value: unknown): Lead[] {
  return Array.isArray(value) ? (value as Lead[]) : [];
}

function asJobs(value: unknown): CampaignActivityJob[] {
  return Array.isArray(value) ? (value as CampaignActivityJob[]) : [];
}

function asActivityBuckets(value: unknown): CampaignActivityDay[] {
  return Array.isArray(value) ? (value as CampaignActivityDay[]) : [];
}

function seedCampaignEditor(campaignId: string, impersonatingCoachId?: string | null) {
  const core = peekHubQuery<CampaignDetailCorePayload>(
    campaignCoreQueryKey(campaignId, impersonatingCoachId)
  );
  const extras = peekHubQuery<CampaignDetailExtrasPayload>(
    campaignExtrasQueryKey(campaignId, impersonatingCoachId)
  );
  const hub = peekHubQuery<CampaignsHubPayload>(
    hubQueryKey("campaigns", impersonatingCoachId)
  );
  const listed =
    hub?.campaigns.find((row) => row.id === campaignId) ??
    hub?.archivedCampaigns.find((row) => row.id === campaignId);
  const campaign = asCampaign(core?.campaign) ?? asCampaign(listed);
  return {
    campaign,
    steps: asSteps(core?.steps),
    leads: asLeads(core?.leads),
    coreReady: Boolean(core),
    jobs: asJobs(extras?.jobs),
    abStats: (extras?.ab?.stats as Record<
      string,
      Record<string, AbVariantStats>
    > | null) ?? null,
    activityBuckets: asActivityBuckets(extras?.activity?.buckets),
    accounts: (hub?.accounts ?? []).map((account) => ({
      id: account.id,
      status: account.status,
      display_name: account.display_name,
      provider: account.provider,
    })),
    otherCampaigns: (hub?.campaigns ?? [])
      .filter((row) => row.id !== campaignId)
      .map((row) => ({
        id: String(row.id ?? ""),
        name: typeof row.name === "string" ? row.name : "Untitled campaign",
      }))
      .filter((row) => row.id),
  };
}

export function LinkedInCampaignEditor() {
  const params = useParams();
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const prefix = pathname.startsWith("/admin") ? "/admin" : "/coach";
  const campaignId = String(params.id || "");
  const { impersonatingCoachId } = useImpersonation();
  const seeded = seedCampaignEditor(campaignId, impersonatingCoachId);

  const [accounts, setAccounts] = useState<Account[]>(() => seeded.accounts);
  const [campaign, setCampaign] = useState<Campaign | null>(() => seeded.campaign);
  const [steps, setSteps] = useState<Step[]>(() => seeded.steps);
  const [leads, setLeads] = useState<Lead[]>(() => seeded.leads);
  const [jobs, setJobs] = useState<CampaignActivityJob[]>(() => seeded.jobs);
  const [loading, setLoading] = useState(() => !seeded.campaign);
  const [coreReady, setCoreReady] = useState(() => seeded.coreReady);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>("overview");
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [abStats, setAbStats] = useState<Record<
    string,
    Record<string, AbVariantStats>
  > | null>(() => seeded.abStats);
  const [activityBuckets, setActivityBuckets] = useState<CampaignActivityDay[]>(
    () => seeded.activityBuckets
  );
  const [leadDrawer, setLeadDrawer] = useState<LeadDrawerFilter | null>(null);
  const [addLeadsOpen, setAddLeadsOpen] = useState(false);
  const [addLeadsMode, setAddLeadsMode] =
    useState<CampaignAddProspectsMode>("named");
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [connectingProvider, setConnectingProvider] = useState<string | null>(
    null
  );
  const [otherCampaigns, setOtherCampaigns] = useState<
    Array<{ id: string; name: string }>
  >(() => seeded.otherCampaigns);

  useEffect(() => {
    if (!editingName) return;
    nameInputRef.current?.focus();
    nameInputRef.current?.select();
  }, [editingName]);

  useEffect(() => {
    const url = new URL(window.location.href);
    const raw = url.searchParams.get("tab");
    if (raw !== "steps" && raw !== "prospects") return;
    setTab(raw);
    url.searchParams.delete("tab");
    const next = url.searchParams.toString();
    window.history.replaceState(
      null,
      "",
      next ? `${url.pathname}?${next}` : url.pathname
    );
  }, []);

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

  const applyCore = useCallback((payload: CampaignDetailCorePayload) => {
    const next = asCampaign(payload.campaign);
    if (next) setCampaign(next);
    setSteps(asSteps(payload.steps));
    setLeads(asLeads(payload.leads));
    setCoreReady(true);
  }, []);

  const applyExtras = useCallback((payload: CampaignDetailExtrasPayload) => {
    setJobs(asJobs(payload.jobs));
    setAbStats(
      (payload.ab?.stats as Record<
        string,
        Record<string, AbVariantStats>
      > | null) ?? null
    );
    setActivityBuckets(asActivityBuckets(payload.activity?.buckets));
  }, []);

  const loadCore = useCallback(
    async (opts?: { force?: boolean }) => {
      if (!campaignId) return;
      const payload = await fetchHubQuery(
        campaignCoreQueryKey(campaignId, impersonatingCoachId),
        () => loadCampaignCorePayload(campaignId),
        opts
      );
      applyCore(payload);
    },
    [applyCore, campaignId, impersonatingCoachId]
  );

  const loadExtras = useCallback(
    async (opts?: { force?: boolean }) => {
      if (!campaignId) return;
      const payload = await fetchHubQuery(
        campaignExtrasQueryKey(campaignId, impersonatingCoachId),
        () => loadCampaignExtrasPayload(campaignId),
        opts
      );
      applyExtras(payload);
    },
    [applyExtras, campaignId, impersonatingCoachId]
  );

  const load = useCallback(async () => {
    await Promise.all([
      loadCore({ force: true }),
      loadExtras({ force: true }),
    ]);
  }, [loadCore, loadExtras]);

  useEffect(() => {
    let cancelled = false;
    const nextSeed = seedCampaignEditor(campaignId, impersonatingCoachId);
    setCampaign(nextSeed.campaign);
    setSteps(nextSeed.steps);
    setLeads(nextSeed.leads);
    setJobs(nextSeed.jobs);
    setAbStats(nextSeed.abStats);
    setActivityBuckets(nextSeed.activityBuckets);
    setAccounts(nextSeed.accounts);
    setOtherCampaigns(nextSeed.otherCampaigns);
    setCoreReady(nextSeed.coreReady);
    if (!nextSeed.campaign) setLoading(true);
    else setLoading(false);
    setError(null);

    (async () => {
      try {
        await loadCore();
        if (!cancelled) setLoading(false);
        void loadExtras();
        if (!nextSeed.accounts.length) {
          const headers = await authHeaders(impersonatingCoachId);
          if (headers) {
            const accRes = await fetch("/api/coach/linkedin-outreach/accounts", {
              headers,
            });
            const accBody = await accRes.json().catch(() => ({}));
            if (!cancelled && accRes.ok) {
              setAccounts(accBody.accounts ?? []);
            }
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Load failed.");
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [campaignId, impersonatingCoachId, loadCore, loadExtras]);

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
    if (leadDrawer.kind === "invite") {
      return leads.filter(
        (l) =>
          inviteFunnelSliceForLead(l, leadDrawer.position) === leadDrawer.slice
      );
    }
    if (leadDrawer.kind === "wait") {
      return leads.filter((l) =>
        leadIsHeldByWait({
          lead: l,
          waitPosition: leadDrawer.position,
          steps,
        })
      );
    }
    return leads.filter(
      (l) =>
        (l.current_step_position ?? 0) === leadDrawer.position &&
        !leadIsHeldBeforeAction({
          lead: l,
          actionPosition: leadDrawer.position,
          steps,
        })
    );
  }, [leadDrawer, leads, stagingLeads, activeLeads, steps]);

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

  const saveStepsInFlight = useRef(false);
  const saveStepsPending = useRef<{
    steps: Step[];
    options?: { releaseWaitPosition?: number };
  } | null>(null);

  async function saveSteps(
    nextSteps?: Step[],
    options?: { releaseWaitPosition?: number }
  ) {
    if (!campaignId) return;
    saveStepsPending.current = {
      steps: nextSteps ?? stepsRef.current,
      options,
    };
    if (saveStepsInFlight.current) return;
    saveStepsInFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      while (saveStepsPending.current) {
        const job = saveStepsPending.current;
        saveStepsPending.current = null;
        const headers = await authHeaders(impersonatingCoachId);
        if (!headers) throw new Error("Sign in required.");
        const res = await fetch(
          `/api/coach/linkedin-outreach/campaigns/${encodeURIComponent(campaignId)}`,
          {
            method: "PATCH",
            headers,
            body: JSON.stringify({
              steps: job.steps,
              ...(job.options?.releaseWaitPosition != null
                ? { release_wait_position: job.options.releaseWaitPosition }
                : {}),
            }),
          }
        );
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || "Save failed.");
        setSteps(body.steps ?? job.steps);
        if (job.options?.releaseWaitPosition != null) await load();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      saveStepsInFlight.current = false;
      setBusy(false);
    }
  }

  async function markLeadInterest(leadId: string, outcome: string | null) {
    setBusy(true);
    try {
      const headers = await authHeaders(impersonatingCoachId);
      if (!headers) return;
      await fetch("/api/coach/linkedin-outreach/interest", {
        method: "POST",
        headers,
        body: JSON.stringify(
          outcome
            ? { lead_id: leadId, outcome }
            : { lead_id: leadId, action: "clear" }
        ),
      });
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function deleteLeads(leadIds: string[]) {
    if (!campaignId || leadIds.length === 0) return;
    setBusy(true);
    try {
      const headers = await authHeaders(impersonatingCoachId);
      if (!headers) return;
      await fetch(
        `/api/coach/linkedin-outreach/campaigns/${encodeURIComponent(campaignId)}`,
        {
          method: "PATCH",
          headers,
          body: JSON.stringify({ action: "delete_leads", lead_ids: leadIds }),
        }
      );
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function pauseLeads(leadIds: string[]) {
    if (!campaignId || leadIds.length === 0) return;
    setBusy(true);
    try {
      const headers = await authHeaders(impersonatingCoachId);
      if (!headers) return;
      await fetch(
        `/api/coach/linkedin-outreach/campaigns/${encodeURIComponent(campaignId)}`,
        {
          method: "PATCH",
          headers,
          body: JSON.stringify({ action: "pause_leads", lead_ids: leadIds }),
        }
      );
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function resumeLeads(leadIds: string[]) {
    if (!campaignId || leadIds.length === 0) return;
    setBusy(true);
    try {
      const headers = await authHeaders(impersonatingCoachId);
      if (!headers) return;
      await fetch(
        `/api/coach/linkedin-outreach/campaigns/${encodeURIComponent(campaignId)}`,
        {
          method: "PATCH",
          headers,
          body: JSON.stringify({ action: "resume_leads", lead_ids: leadIds }),
        }
      );
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function moveLeads(leadIds: string[], targetCampaignId: string) {
    if (!campaignId || leadIds.length === 0) return;
    setBusy(true);
    try {
      const headers = await authHeaders(impersonatingCoachId);
      if (!headers) return;
      await fetch(
        `/api/coach/linkedin-outreach/campaigns/${encodeURIComponent(campaignId)}`,
        {
          method: "PATCH",
          headers,
          body: JSON.stringify({
            action: "move_leads",
            lead_ids: leadIds,
            target_campaign_id: targetCampaignId,
          }),
        }
      );
      await load();
    } finally {
      setBusy(false);
    }
  }

  function addStep(
    type: Step["step_type"],
    atIndex?: number,
    mediaKind?: CampaignStepMediaKind
  ) {
    const insertAt = Math.max(0, Math.min(atIndex ?? steps.length, steps.length));
    const created: Step = {
      position: insertAt,
      step_type: type,
      body: campaignStepHasCopy(type) ? "" : null,
      wait_hours: type === "wait" ? 24 : null,
      ...campaignNewStepSendFields(
        type,
        sequenceMessageSendMode(steps),
        campaign?.manual_fallback_hours
      ),
      config: {
        ...defaultStepConfig(type),
        ...(mediaKind ? { media_kind: mediaKind } : {}),
      },
    };
    const next = [...steps.slice(0, insertAt), created, ...steps.slice(insertAt)].map(
      (s, i) => ({ ...s, position: i })
    );
    setSteps(next);
    void saveSteps(next);
  }

  function reorderSteps(next: Step[]) {
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
    const removed = steps[index];
    const next = steps
      .filter((_, i) => i !== index)
      .map((s, i) => ({ ...s, position: i }));
    setSteps(next);
    void saveSteps(
      next,
      removed?.step_type === "wait"
        ? { releaseWaitPosition: removed.position ?? index }
        : undefined
    );
  }

  function duplicateStep(index: number) {
    const current = stepsRef.current;
    const next = duplicateCampaignStep(current, index);
    if (next === current) return;
    stepsRef.current = next;
    setSteps(next);
    void saveSteps(next);
  }

  async function applyLibraryTemplate(templateId: string) {
    if (!campaignId) return;
    setBusy(true);
    setError(null);
    try {
      const headers = await authHeaders(impersonatingCoachId);
      if (!headers) throw new Error("Sign in required.");
      const res = await fetch(
        `/api/coach/linkedin-outreach/campaigns/${encodeURIComponent(campaignId)}`,
        {
          method: "PATCH",
          headers,
          body: JSON.stringify({
            action: "apply_library_template",
            library_template_id: templateId,
          }),
        }
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Could not apply template.");
      const next = asSteps(body.steps);
      stepsRef.current = next;
      setSteps(next);
      setTemplatePickerOpen(false);
      invalidateHubQuery(campaignCoreQueryKey(campaignId, impersonatingCoachId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not apply template.");
    } finally {
      setBusy(false);
    }
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

  function peopleAtStep(step: Step, index: number) {
    const pos = step.position ?? index;
    if (step.step_type === "wait") {
      const held = leads.filter((l) =>
        leadIsHeldByWait({ lead: l, waitPosition: pos, steps })
      );
      const nextTimes = held
        .map((l) => l.next_action_at)
        .filter((iso): iso is string => Boolean(iso))
        .sort(
          (a, b) => new Date(a).getTime() - new Date(b).getTime()
        );
      return {
        here: held.length,
        wait: {
          names: held.slice(0, 4).map(leadName),
          nextLabel: formatUpcomingWhen(nextTimes[0] ?? null),
        },
      };
    }
    if (step.step_type !== "invite") return { here: 0 };
    const funnel = inviteFunnelCounts(leads, pos);
    const names: Record<InviteFunnelSlice, string[]> = {
      connected: [],
      waiting: [],
      remaining: [],
    };
    for (const lead of leads) {
      const slice = inviteFunnelSliceForLead(lead, pos);
      if (names[slice].length < 4) names[slice].push(leadName(lead));
    }
    return { here: 0, invite: { ...funnel, names } };
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
  const archived = activeCampaign.status === "archived";

  function openAddLeads(mode: CampaignAddProspectsMode = "named") {
    setAddLeadsMode(mode);
    setAddLeadsOpen(true);
  }

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
    if (activeCampaign.status === "archived") return;
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
      <div className="pt-1">
        <Link
          href={`${prefix}/campaigns`}
          className="inline-flex items-center text-sm text-slate-500 hover:text-slate-800"
        >
          ← Campaigns
        </Link>
        <div className="mt-1.5 flex min-w-0 items-center gap-3">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
            <CampaignOnOffToggle
              on={running}
              busy={busy}
              disabled={archived || (!running && !canStart)}
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
              <div className="flex min-w-0 items-center gap-1.5">
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
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={settingsOpen}
            className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-sm font-semibold text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0c5290]/40 focus-visible:ring-offset-2 ${
              settingsOpen
                ? "border-slate-400 bg-slate-50"
                : "border-slate-300 bg-transparent hover:border-slate-400 hover:bg-slate-50/60"
            }`}
          >
            <SlidersHorizontal
              className="h-3.5 w-3.5 text-slate-500"
              strokeWidth={2.25}
              aria-hidden
            />
            Settings
          </button>
        </div>
      </div>

      <div className="mt-2 border-b border-slate-200">
        <PageHeaderUnderlineTabs
          ariaLabel="Campaign sections"
          className="min-w-0"
          items={TAB_ITEMS.map((item) => ({
            kind: "button" as const,
            id: item.id,
            label: item.label,
            active: tab === item.id,
            onClick: () => setTab(item.id),
          }))}
        />
      </div>

      {error && !templatePickerOpen ? (
        <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </div>
      ) : null}

      {/* ——— OVERVIEW ——— */}
      {tab === "overview" ? (
        <div className="mt-4 min-h-[60vh] space-y-6">
          {!coreReady ? (
            <div className="rounded-2xl border border-slate-200 px-6 py-16 text-center text-sm text-slate-500">
              Loading overview…
            </div>
          ) : leads.length === 0 ? (
            <CampaignAudienceEmpty
              variant="overview"
              running={running}
              hasSteps={steps.length > 0}
              onAdd={openAddLeads}
              onSetupSteps={() => setTab("steps")}
            />
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
                  statusCounts={statusCounts}
                  onAddProspects={() => openAddLeads()}
                  onOpenStatus={(status) =>
                    setLeadDrawer({
                      kind: "status",
                      status,
                      title: activityLeadStatusLabel(status),
                    })
                  }
                  onViewAll={() => setTab("prospects")}
                />
                <CampaignDialsPanel
                  dials={buildCampaignDials({
                    leads,
                    hasInviteStep,
                  })}
                />
              </div>

              <CampaignDailyStackChart buckets={activityBuckets} />
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
            prospectHref={(lead) =>
              prospectDetailHref(lead.contact_id, prefix === "/admin")
            }
            busy={busy}
            campaigns={otherCampaigns}
            onAdd={openAddLeads}
            onDelete={(leadIds) => void deleteLeads(leadIds)}
            onPause={(leadIds) => void pauseLeads(leadIds)}
            onResume={(leadIds) => void resumeLeads(leadIds)}
            onMove={(leadIds, targetId) => void moveLeads(leadIds, targetId)}
            repliesHref={`${prefix}/conversations?campaign=${encodeURIComponent(campaign.id)}`}
            onMarkInterest={(leadId, outcome) =>
              void markLeadInterest(leadId, outcome)
            }
          />
        </div>
      ) : null}

      {/* ——— STEPS ——— */}
      {tab === "steps" ? (
        <CampaignSequenceBuilder
          steps={steps}
          campaignId={campaign.id}
          peopleAtStep={peopleAtStep}
          abStats={abStats}
          accounts={accounts}
          connectingProvider={connectingProvider}
          onAddStep={addStep}
          onConnect={(provider) => void connectProvider(provider)}
          onPatchStep={patchStep}
          onCommitSteps={commitSteps}
          onDeleteStep={deleteStep}
          onDuplicateStep={duplicateStep}
          onReorderSteps={reorderSteps}
          onOpenLeads={setLeadDrawer}
          campaigns={otherCampaigns}
          queuePeople={{
            count: stagingLeads.length,
            names: stagingLeads.slice(0, 4).map(leadName),
          }}
          onChooseTemplate={() => setTemplatePickerOpen(true)}
          mergeFields={mergeFieldPickerForPlaybook(campaign.source_playbook_id)}
          manualFallbackHours={campaign.manual_fallback_hours ?? null}
          onManualFallbackHoursChange={(hours) => {
            setCampaign({ ...campaign, manual_fallback_hours: hours });
            void saveSettings({ manual_fallback_hours: hours });
          }}
        />
      ) : null}

      <CampaignTemplatePickerModal
        open={templatePickerOpen}
        busy={busy}
        error={templatePickerOpen ? error : null}
        onClose={() => {
          if (busy) return;
          setTemplatePickerOpen(false);
          setError(null);
        }}
        onPick={(template) => void applyLibraryTemplate(template.id)}
      />

      <CampaignSettingsModal
        open={settingsOpen}
        campaign={campaign}
        busy={busy}
        onClose={() => setSettingsOpen(false)}
        onCampaignChange={(patch) =>
          setCampaign({ ...campaign, ...patch })
        }
        onSave={(patch) => void saveSettings(patch)}
        onArchive={() => {
          if (
            !window.confirm(
              `Archive “${campaign.name}”? You can restore it later from Archived, or pick Live again.`
            )
          ) {
            return;
          }
          void saveSettings({ status: "archived" }).then(() => {
            invalidateHubQuery(hubQueryKey("campaigns", impersonatingCoachId));
          });
        }}
        onUnarchive={() => {
          void saveSettings({ action: "unarchive" }).then(() => {
            invalidateHubQuery(hubQueryKey("campaigns", impersonatingCoachId));
          });
        }}
        onDelete={() => {
          void (async () => {
            setBusy(true);
            setError(null);
            try {
              const headers = await authHeaders(impersonatingCoachId);
              if (!headers) throw new Error("Sign in required.");
              const res = await fetch(
                `/api/coach/linkedin-outreach/campaigns/${encodeURIComponent(campaign.id)}`,
                {
                  method: "PATCH",
                  headers,
                  body: JSON.stringify({ action: "delete" }),
                }
              );
              const body = await res.json().catch(() => ({}));
              if (!res.ok) throw new Error(body.error || "Delete failed.");
              setSettingsOpen(false);
              invalidateHubQuery(
                hubQueryKey("campaigns", impersonatingCoachId)
              );
              invalidateHubQuery(
                campaignCoreQueryKey(campaign.id, impersonatingCoachId)
              );
              router.push(`${prefix}/campaigns`);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Delete failed.");
            } finally {
              setBusy(false);
            }
          })();
        }}
      />

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
                drawerLeads.map((lead) => {
                  const href = prospectDetailHref(
                    lead.contact_id,
                    prefix === "/admin"
                  );
                  const name = leadName(lead);
                  const body = (
                    <>
                      <div className="min-w-0 flex-1">
                        <div
                          className={`truncate text-sm font-medium ${
                            href ? "text-[#0c5290]" : "text-slate-900"
                          }`}
                        >
                          {name}
                        </div>
                        <div className="truncate text-xs text-slate-500">
                          {activityLeadStatusLabel(lead.status)}
                          {lead.company ? ` · ${lead.company}` : ""}
                        </div>
                      </div>
                      {href ? (
                        <ChevronRight
                          className="h-4 w-4 shrink-0 text-slate-400"
                          aria-hidden
                        />
                      ) : null}
                    </>
                  );
                  return (
                    <li key={lead.id}>
                      {href ? (
                        <Link
                          href={href}
                          aria-label={`Open ${name}`}
                          className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50"
                        >
                          {body}
                        </Link>
                      ) : (
                        <div className="flex items-center gap-3 px-5 py-3">
                          {body}
                        </div>
                      )}
                    </li>
                  );
                })
              )}
            </ul>
          </aside>
        </div>
      ) : null}

      <CampaignAddProspectsModal
        key={addLeadsMode}
        open={addLeadsOpen}
        campaignId={campaignId}
        campaignChannel={campaign?.channel}
        initialMode={addLeadsMode}
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
