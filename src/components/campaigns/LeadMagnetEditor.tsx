"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { Check, Copy, Info, PencilLine, Share2 } from "lucide-react";
import { getCoachAuthHeaders } from "@/lib/coachAuthHeaders";
import { buttonClass } from "@/components/ui/Button";
import {
  CampaignSequenceBuilder,
  EMPTY_STEP_PEOPLE,
  type SequenceStep,
} from "@/components/campaigns/CampaignSequenceBuilder";
import { CampaignsSubTabs } from "@/components/campaigns/CampaignsSubTabs";
import { CoachWatchRulesPanel } from "@/components/campaigns/CoachWatchRulesPanel";
import { LeadMagnetOverview } from "@/components/leadMagnets/LeadMagnetOverview";
import { LeadMagnetPeople } from "@/components/leadMagnets/LeadMagnetPeople";
import { LeadMagnetShareModal } from "@/components/leadMagnets/LeadMagnetShareModal";
import { PageHeaderUnderlineTabs } from "@/components/layout/PageHeaderUnderlineTabs";
import {
  LandingStatsCustomRangeFields,
  LandingStatsRangeDropdown,
} from "@/components/prospects/ProspectsLandingStats";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import {
  emptyMagnetAudience,
  type MagnetAudience,
  type MagnetStage,
} from "@/lib/leadMagnets/audienceTypes";
import {
  getLeadMagnet,
  magnetShareCopyUrl,
  magnetShareDisplayUrl,
  type LeadMagnetSequenceDef,
} from "@/lib/leadMagnets/catalog";
import {
  defaultLandingStatsRange,
  isLandingStatsRangeValid,
  landingStatsRangeQuery,
  type LandingStatsRange,
} from "@/lib/landingStatsRange";
import { prospectDetailHref } from "@/lib/prospects/prospectDetailHref";
import { campaignNewStepSendFields, campaignStepHasCopy, defaultStepConfig, sequenceMessageSendMode, type CampaignStepType } from "@/lib/unipile/campaignStepTypes";
import { mergeFieldPickerForMagnet } from "@/lib/unipile/mergeFields";
import { duplicateCampaignStep } from "@/lib/unipile/campaignStepDuplicate";
import type { UnipileConnectProvider } from "@/lib/unipile/providers";

type Account = {
  id: string;
  status: string;
  display_name: string | null;
  provider?: string;
};

type MagnetTab = "overview" | "people" | "sequences";

const MAGNET_TABS: Array<{ id: MagnetTab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "people", label: "People" },
  { id: "sequences", label: "Sequences" },
];

const SEQUENCES_TAB_HINT =
  "Follow-up messages after someone starts or finishes.";

function TabHint({ text }: { text: string }) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const [box, setBox] = useState<{ top: number; left: number } | null>(null);

  function show() {
    const rect = anchorRef.current?.getBoundingClientRect();
    if (!rect) return;
    setBox({ top: rect.top - 6, left: rect.left + rect.width / 2 });
  }

  return (
    <span
      ref={anchorRef}
      className="inline-flex text-current/55"
      onMouseEnter={show}
      onMouseLeave={() => setBox(null)}
      onFocus={show}
      onBlur={() => setBox(null)}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      <Info className="h-3.5 w-3.5" aria-hidden />
      <span className="sr-only">{text}</span>
      {box
        ? createPortal(
            <span
              role="tooltip"
              style={{ top: box.top, left: box.left }}
              className="pointer-events-none fixed z-50 w-max max-w-[16rem] -translate-x-1/2 -translate-y-full rounded-md bg-slate-900 px-2.5 py-1.5 text-left text-caption font-medium leading-snug text-white shadow-sm"
            >
              {text}
            </span>,
            document.body
          )
        : null}
    </span>
  );
}

function tabLabel(title: string, hint?: string) {
  if (!hint) return title;
  return (
    <span className="inline-flex items-center gap-1">
      {title}
      <TabHint text={hint} />
    </span>
  );
}

function readMagnetTab(): MagnetTab {
  if (typeof window === "undefined") return "overview";
  const raw = new URLSearchParams(window.location.search).get("tab");
  if (raw === "people" || raw === "sequences") return raw;
  return "overview";
}

type SequenceState = {
  def: LeadMagnetSequenceDef;
  campaignId: string;
  steps: SequenceStep[];
};

async function authHeaders() {
  return getCoachAuthHeaders();
}

export function LeadMagnetEditor() {
  const params = useParams();
  const pathname = usePathname() ?? "";
  const { impersonatingCoachId } = useImpersonation();
  const prefix = (pathname.startsWith("/admin") ? "/admin" : "/coach") as
    | "/admin"
    | "/coach";
  const magnetId = String(params.magnetId || "");
  const magnet = getLeadMagnet(magnetId);

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [sequences, setSequences] = useState<SequenceState[]>([]);
  const [coachSlug, setCoachSlug] = useState<string | null>(null);
  const [appOrigin, setAppOrigin] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectingProvider, setConnectingProvider] = useState<string | null>(
    null
  );
  const [sequenceTab, setSequenceTab] = useState<string | null>(null);
  const [tab, setTab] = useState<MagnetTab>("overview");
  const [dateRange, setDateRange] = useState<LandingStatsRange>(
    defaultLandingStatsRange
  );
  const [audience, setAudience] = useState<MagnetAudience | null>(null);
  const [audienceLoading, setAudienceLoading] = useState(true);
  const [audienceError, setAudienceError] = useState<string | null>(null);
  const [peopleStage, setPeopleStage] = useState<MagnetStage | "all">("all");
  const [shareOpen, setShareOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [otherCampaigns, setOtherCampaigns] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const sequencesRef = useRef(sequences);
  sequencesRef.current = sequences;

  useEffect(() => {
    setAppOrigin(window.location.origin);
    setTab(readMagnetTab());
  }, []);

  const rangeQuery = useMemo(
    () => landingStatsRangeQuery(dateRange),
    [dateRange]
  );
  const rangeValid = isLandingStatsRangeValid(dateRange);

  useEffect(() => {
    if (!magnet) return;
    if (!rangeValid) {
      setAudienceLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setAudienceLoading(true);
      setAudienceError(null);
      try {
        const headers = await authHeaders();
        if (!headers) {
          if (!cancelled) setAudience(emptyMagnetAudience());
          return;
        }
        const url = rangeQuery
          ? `/api/coach/lead-magnets/${encodeURIComponent(magnet.id)}/audience?${rangeQuery}`
          : `/api/coach/lead-magnets/${encodeURIComponent(magnet.id)}/audience`;
        const res = await fetch(url, { headers });
        const body = (await res.json().catch(() => ({}))) as MagnetAudience & {
          error?: string;
        };
        if (!res.ok) throw new Error(body.error || "Could not load people.");
        if (!cancelled) setAudience(body);
      } catch (err) {
        if (!cancelled) {
          setAudience(emptyMagnetAudience());
          setAudienceError(
            err instanceof Error ? err.message : "Could not load people."
          );
        }
      } finally {
        if (!cancelled) setAudienceLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [magnet, rangeQuery, rangeValid, impersonatingCoachId]);

  const load = useCallback(async () => {
    const headers = await authHeaders();
    if (!headers || !magnet) return;
    const [accRes, campRes, profileRes] = await Promise.all([
      fetch("/api/coach/linkedin-outreach/accounts", { headers }),
      fetch("/api/coach/linkedin-outreach/campaigns", { headers }),
      fetch("/api/coach/profile", { headers }),
    ]);
    const accBody = await accRes.json().catch(() => ({}));
    const campBody = await campRes.json().catch(() => ({}));
    const profileBody = await profileRes.json().catch(() => ({}));
    if (!accRes.ok) throw new Error(accBody.error || "Accounts failed.");
    if (!campRes.ok) throw new Error(campBody.error || "Campaigns failed.");
    setAccounts(accBody.accounts ?? []);
    setCoachSlug(
      typeof profileBody.coach_slug === "string"
        ? profileBody.coach_slug.trim() || null
        : null
    );

    const campaigns = (campBody.campaigns ?? []) as Array<{
      id: string;
      name?: string;
      source_playbook_id?: string | null;
    }>;
    setOtherCampaigns(
      campaigns.map((c) => ({
        id: c.id,
        name: (c.name || "Untitled campaign").trim(),
      }))
    );
    const loaded: SequenceState[] = [];
    for (const def of magnet.sequences) {
      const row = campaigns.find((c) => c.source_playbook_id === def.playbookId);
      if (!row) continue;
      const detailRes = await fetch(
        `/api/coach/linkedin-outreach/campaigns/${encodeURIComponent(row.id)}`,
        { headers }
      );
      const detail = await detailRes.json().catch(() => ({}));
      if (!detailRes.ok) {
        throw new Error(detail.error || `Could not load ${def.title}.`);
      }
      loaded.push({
        def,
        campaignId: row.id,
        steps: (detail.steps ?? []) as SequenceStep[],
      });
    }
    setSequences(loaded);
    setSequenceTab((current) => {
      if (current && loaded.some((seq) => seq.def.slot === current)) {
        return current;
      }
      return loaded[0]?.def.slot ?? null;
    });
  }, [magnet]);

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

  async function saveSteps(
    campaignId: string,
    nextSteps: SequenceStep[],
    options?: { releaseWaitPosition?: number }
  ) {
    const headers = await authHeaders();
    if (!headers) throw new Error("Sign in required.");
    const res = await fetch(
      `/api/coach/linkedin-outreach/campaigns/${encodeURIComponent(campaignId)}`,
      {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          steps: nextSteps,
          ...(options?.releaseWaitPosition != null
            ? { release_wait_position: options.releaseWaitPosition }
            : {}),
        }),
      }
    );
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || "Save failed.");
    return (body.steps ?? nextSteps) as SequenceStep[];
  }

  function updateSequence(campaignId: string, nextSteps: SequenceStep[]) {
    setSequences((current) =>
      current.map((seq) =>
        seq.campaignId === campaignId ? { ...seq, steps: nextSteps } : seq
      )
    );
  }

  async function commitSequence(campaignId: string) {
    const seq = sequencesRef.current.find((s) => s.campaignId === campaignId);
    if (!seq) return;
    setError(null);
    try {
      const saved = await saveSteps(campaignId, seq.steps);
      updateSequence(campaignId, saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    }
  }

  function addStep(
    campaignId: string,
    type: CampaignStepType,
    atIndex?: number,
    mediaKind?: "voice" | "video"
  ) {
    const seq = sequencesRef.current.find((s) => s.campaignId === campaignId);
    if (!seq) return;
    const insertAt = Math.max(
      0,
      Math.min(atIndex ?? seq.steps.length, seq.steps.length)
    );
    const created: SequenceStep = {
      position: insertAt,
      step_type: type,
      body: campaignStepHasCopy(type) ? "" : null,
      wait_hours: type === "wait" ? 24 : null,
      ...campaignNewStepSendFields(type, sequenceMessageSendMode(seq.steps)),
      config: {
        ...defaultStepConfig(type),
        ...(mediaKind ? { media_kind: mediaKind } : {}),
      },
    };
    const next = [
      ...seq.steps.slice(0, insertAt),
      created,
      ...seq.steps.slice(insertAt),
    ].map((s, i) => ({ ...s, position: i }));
    updateSequence(campaignId, next);
    void saveSteps(campaignId, next)
      .then((saved) => updateSequence(campaignId, saved))
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Save failed.")
      );
  }

  function patchStep(
    campaignId: string,
    index: number,
    patch: Partial<SequenceStep>
  ) {
    const seq = sequencesRef.current.find((s) => s.campaignId === campaignId);
    if (!seq) return;
    const next = seq.steps.map((s, i) => (i === index ? { ...s, ...patch } : s));
    sequencesRef.current = sequencesRef.current.map((s) =>
      s.campaignId === campaignId ? { ...s, steps: next } : s
    );
    updateSequence(campaignId, next);
  }

  function deleteStep(campaignId: string, index: number) {
    const seq = sequencesRef.current.find((s) => s.campaignId === campaignId);
    if (!seq) return;
    const removed = seq.steps[index];
    const next = seq.steps
      .filter((_, i) => i !== index)
      .map((s, i) => ({ ...s, position: i }));
    updateSequence(campaignId, next);
    void saveSteps(
      campaignId,
      next,
      removed?.step_type === "wait"
        ? { releaseWaitPosition: removed.position ?? index }
        : undefined
    )
      .then((saved) => updateSequence(campaignId, saved))
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Save failed.")
      );
  }

  function duplicateStep(campaignId: string, index: number) {
    const seq = sequencesRef.current.find((s) => s.campaignId === campaignId);
    if (!seq) return;
    const next = duplicateCampaignStep(seq.steps, index);
    if (next === seq.steps) return;
    updateSequence(campaignId, next);
    void saveSteps(campaignId, next)
      .then((saved) => updateSequence(campaignId, saved))
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Save failed.")
      );
  }

  function reorderSteps(campaignId: string, next: SequenceStep[]) {
    updateSequence(campaignId, next);
    void saveSteps(campaignId, next)
      .then((saved) => updateSequence(campaignId, saved))
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Save failed.")
      );
  }

  async function connectProvider(provider: UnipileConnectProvider) {
    setConnectingProvider(provider);
    setError(null);
    try {
      const headers = await authHeaders();
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

  function selectTab(next: MagnetTab) {
    setTab(next);
    const url = new URL(window.location.href);
    if (next === "overview") url.searchParams.delete("tab");
    else url.searchParams.set("tab", next);
    const query = url.searchParams.toString();
    window.history.replaceState(
      null,
      "",
      query ? `${url.pathname}?${query}` : url.pathname
    );
  }

  function openPeople(stage: MagnetStage | "all") {
    setPeopleStage(stage);
    selectTab("people");
  }

  async function copyShareLink(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedLink(true);
      window.setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      setCopiedLink(false);
    }
  }

  if (!magnet) {
    return (
      <div className="space-y-3 py-16 text-center">
        <p className="text-sm text-slate-600">Lead magnet not found.</p>
        <Link
          href={`${prefix}/campaigns?tab=magnets`}
          className="text-sm font-medium text-[#0c5290] hover:underline"
        >
          ← Back to lead magnets
        </Link>
      </div>
    );
  }

  const activeSequence =
    sequences.find((seq) => seq.def.slot === sequenceTab) ?? sequences[0] ?? null;
  const sharePath = coachSlug ? magnet.pathForSlug(coachSlug) : null;
  const displayUrl = sharePath
    ? magnetShareDisplayUrl(sharePath, appOrigin)
    : null;
  const copyUrl = sharePath ? magnetShareCopyUrl(sharePath, appOrigin) : null;
  const showPeopleWindow = tab === "overview" || tab === "people";

  return (
    <div className="flex w-full min-w-0 flex-col gap-5 pb-16">
      <CampaignsSubTabs prefix={prefix} active="magnets" />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-4">
          <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-lg bg-slate-100">
            <Image
              src={magnet.imageSrc}
              alt=""
              fill
              className="object-cover object-top"
              sizes="96px"
            />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold tracking-tight text-slate-900 sm:text-xl">
              {magnet.title}
            </h1>
            <p className="mt-1 max-w-xl text-sm text-slate-500">
              {magnet.id === "boss-score"
                ? "Who opted in, who started the scorecard, and who finished."
                : "Who started the diagnostic, and who finished."}
            </p>
            {displayUrl && copyUrl ? (
              <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                <a
                  href={sharePath ?? undefined}
                  target="_blank"
                  rel="noreferrer"
                  className="max-w-full truncate text-sm text-[#0c5290] hover:underline"
                >
                  {displayUrl}
                </a>
                <button
                  type="button"
                  onClick={() => void copyShareLink(copyUrl)}
                  className="inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-900"
                >
                  {copiedLink ? (
                    <Check className="h-3.5 w-3.5" aria-hidden />
                  ) : (
                    <Copy className="h-3.5 w-3.5" aria-hidden />
                  )}
                  {copiedLink ? "Copied" : "Copy"}
                </button>
              </div>
            ) : loading ? null : (
              <button
                type="button"
                onClick={() => setShareOpen(true)}
                className="mt-2 text-sm font-medium text-[#0c5290] hover:underline"
              >
                Add a public link
              </button>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {magnet.id === "boss-score" && coachSlug ? (
            <a
              href={`/score/${encodeURIComponent(coachSlug)}?edit=1`}
              className={buttonClass("second", "small")}
            >
              <PencilLine className="h-3.5 w-3.5 text-slate-500" strokeWidth={2.25} aria-hidden />
              Edit your page
            </a>
          ) : null}
          <button
            type="button"
            onClick={() => setShareOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={shareOpen}
            className={buttonClass("second", "small")}
          >
            <Share2 className="h-3.5 w-3.5 text-slate-500" strokeWidth={2.25} aria-hidden />
            Share
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </div>
      ) : null}

      <div className="border-b border-slate-200">
        <PageHeaderUnderlineTabs
          ariaLabel="Lead magnet sections"
          items={MAGNET_TABS.map((item) => ({
            kind: "button" as const,
            id: item.id,
            label: tabLabel(
              item.label,
              item.id === "sequences" ? SEQUENCES_TAB_HINT : undefined
            ),
            active: tab === item.id,
            onClick: () => selectTab(item.id),
          }))}
        />
      </div>

      {showPeopleWindow && audienceError ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {audienceError}
        </div>
      ) : null}

      {showPeopleWindow ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <LandingStatsRangeDropdown value={dateRange} onChange={setDateRange} />
            {magnet.id === "boss-score" ? (
              <span className="text-xs text-slate-500">
                {audienceLoading || !rangeValid
                  ? "Views —"
                  : `${(audience?.unique_views ?? 0).toLocaleString()} views`}
              </span>
            ) : null}
          </div>
          <LandingStatsCustomRangeFields value={dateRange} onChange={setDateRange} />
        </div>
      ) : null}

      {tab === "overview" ? (
        <LeadMagnetOverview
          audience={rangeValid ? audience : emptyMagnetAudience()}
          loading={audienceLoading && rangeValid}
          showOptInRate={magnet.id === "boss-score"}
          onOpenStage={(stage) => openPeople(stage)}
          onViewPeople={() => openPeople("all")}
        />
      ) : null}

      {tab === "people" ? (
        <LeadMagnetPeople
          people={rangeValid ? (audience?.people ?? []) : []}
          loading={audienceLoading && rangeValid}
          stage={peopleStage}
          onStageChange={setPeopleStage}
          prospectHref={(contactId) =>
            prospectDetailHref(contactId, prefix === "/admin")
          }
        />
      ) : null}

      {tab === "sequences" ? (
        loading ? (
          <p className="py-16 text-center text-sm text-slate-500">
            Loading sequences…
          </p>
        ) : sequences.length === 0 || !activeSequence ? (
          <p className="text-sm text-slate-500">
            Sequences for this magnet are not set up yet. Refresh to seed them.
          </p>
        ) : (
          <>
            <div className="border-b border-slate-200">
              <PageHeaderUnderlineTabs
                ariaLabel="Magnet sequences"
                items={sequences.map((seq) => ({
                  kind: "button" as const,
                  id: seq.def.slot,
                  label: tabLabel(seq.def.title, seq.def.description),
                  active: seq.def.slot === activeSequence.def.slot,
                  onClick: () => setSequenceTab(seq.def.slot),
                }))}
              />
            </div>
            <CampaignSequenceBuilder
              steps={activeSequence.steps}
              campaignId={activeSequence.campaignId}
              mergeFields={mergeFieldPickerForMagnet(
                magnet.id,
                activeSequence.def.slot
              )}
              peopleAtStep={() => EMPTY_STEP_PEOPLE}
              abStats={null}
              accounts={accounts}
              connectingProvider={connectingProvider}
              onAddStep={(type, at, mediaKind) =>
                addStep(activeSequence.campaignId, type, at, mediaKind)
              }
              onConnect={(provider) => void connectProvider(provider)}
              onPatchStep={(index, patch) =>
                patchStep(activeSequence.campaignId, index, patch)
              }
              onCommitSteps={() => void commitSequence(activeSequence.campaignId)}
              onDeleteStep={(index) =>
                deleteStep(activeSequence.campaignId, index)
              }
              onDuplicateStep={(index) =>
                duplicateStep(activeSequence.campaignId, index)
              }
              onReorderSteps={(next) =>
                reorderSteps(activeSequence.campaignId, next)
              }
              onOpenLeads={() => undefined}
              campaigns={otherCampaigns.filter(
                (c) => c.id !== activeSequence.campaignId
              )}
              sidebarExtra={
                <CoachWatchRulesPanel
                  scopeKind="magnet"
                  scopeId={magnet.id}
                />
              }
            />
          </>
        )
      ) : null}

      <LeadMagnetShareModal
        open={shareOpen}
        magnetId={magnet.id}
        title={magnet.title}
        coachSlug={coachSlug}
        appOrigin={appOrigin}
        impersonatingCoachId={impersonatingCoachId}
        prospectsHref={`${prefix}/prospects`}
        onSlugChange={setCoachSlug}
        onClose={() => setShareOpen(false)}
      />
    </div>
  );
}
