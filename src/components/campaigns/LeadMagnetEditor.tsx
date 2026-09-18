"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { getCoachAuthHeaders } from "@/lib/coachAuthHeaders";
import { CampaignSequenceBuilder } from "@/components/campaigns/CampaignSequenceBuilder";
import type { SequenceStep } from "@/components/campaigns/CampaignSequenceBuilder";
import { CampaignsSubTabs } from "@/components/campaigns/CampaignsSubTabs";
import { CoachWatchRulesPanel } from "@/components/campaigns/CoachWatchRulesPanel";
import { LeadMagnetShareSettings } from "@/components/leadMagnets/LeadMagnetShareSettings";
import { PageHeaderUnderlineTabs } from "@/components/layout/PageHeaderUnderlineTabs";
import { ProspectsLandingStats } from "@/components/prospects/ProspectsLandingStats";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import {
  getLeadMagnet,
  type LeadMagnetSequenceDef,
} from "@/lib/leadMagnets/catalog";
import { campaignStepHasCopy, defaultStepConfig, type CampaignStepType } from "@/lib/unipile/campaignStepTypes";
import type { UnipileConnectProvider } from "@/lib/unipile/providers";

type Account = {
  id: string;
  status: string;
  display_name: string | null;
  provider?: string;
};

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
  const [otherCampaigns, setOtherCampaigns] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const sequencesRef = useRef(sequences);
  sequencesRef.current = sequences;

  useEffect(() => {
    setAppOrigin(window.location.origin);
  }, []);

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

  async function saveSteps(campaignId: string, nextSteps: SequenceStep[]) {
    const headers = await authHeaders();
    if (!headers) throw new Error("Sign in required.");
    const res = await fetch(
      `/api/coach/linkedin-outreach/campaigns/${encodeURIComponent(campaignId)}`,
      { method: "PATCH", headers, body: JSON.stringify({ steps: nextSteps }) }
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
      send_mode: "auto",
      fallback_hours: null,
      fallback_body: null,
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
    const next = seq.steps
      .filter((_, i) => i !== index)
      .map((s, i) => ({ ...s, position: i }));
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

  if (loading) {
    return (
      <div className="py-20 text-center text-sm text-slate-500">
        Loading {magnet.title}…
      </div>
    );
  }

  const activeSequence =
    sequences.find((seq) => seq.def.slot === sequenceTab) ?? sequences[0] ?? null;

  return (
    <div className="flex w-full min-w-0 flex-col gap-5 pb-16">
      <CampaignsSubTabs prefix={prefix} active="magnets" />

      <div className="flex flex-wrap items-start gap-4">
        <div className="relative h-20 w-28 shrink-0 overflow-hidden rounded-lg bg-slate-100 sm:h-24 sm:w-36">
          <Image
            src={magnet.imageSrc}
            alt={magnet.imageAlt}
            fill
            className="object-cover object-top"
            sizes="144px"
          />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold tracking-tight text-slate-900 sm:text-xl">
            {magnet.title}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            {magnet.description}
          </p>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </div>
      ) : null}

      {magnet.id === "boss-score" ? (
        <ProspectsLandingStats
          coachSlug={coachSlug}
          impersonatingCoachId={impersonatingCoachId ?? null}
        />
      ) : null}

      <LeadMagnetShareSettings
        magnetId={magnet.id}
        coachSlug={coachSlug}
        appOrigin={appOrigin}
        impersonatingCoachId={impersonatingCoachId}
        prospectsHref={`${prefix}/prospects`}
      />

      {sequences.length === 0 || !activeSequence ? (
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
                label: seq.def.title,
                active: seq.def.slot === activeSequence.def.slot,
                onClick: () => setSequenceTab(seq.def.slot),
              }))}
            />
          </div>
          <p className="text-sm text-slate-500">{activeSequence.def.description}</p>
          <CampaignSequenceBuilder
            steps={activeSequence.steps}
            campaignId={activeSequence.campaignId}
            countAtStep={() => 0}
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
      )}
    </div>
  );
}
