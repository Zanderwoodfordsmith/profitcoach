"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import {
  AiNote,
  Chip,
  ErrorNote,
  EmptyState,
  PrimaryButton,
  SecondaryButton,
} from "@/components/firstCampaign/firstCampaignUi";
import {
  CampaignSetupProgress,
  useCampaignProgressRunner,
} from "@/components/firstCampaign/CampaignSetupProgress";
import type { IcpProposal, SourcingRoute } from "@/lib/firstCampaign/types";
import { apiPost, type ChosenIcp } from "@/lib/firstCampaign/wizardApi";

type ProposalsResponse = { proposals?: IcpProposal[]; error?: string };
type ChooseIcpResponse = { icp?: ChosenIcp; error?: string };

const SOURCING_LABEL: Record<SourcingRoute, string> = {
  strong: "Strong inventory",
  thin: "Thin inventory",
  none: "We'll source this",
};

const SOURCING_TONE: Record<SourcingRoute, "emerald" | "amber" | "slate"> = {
  strong: "emerald",
  thin: "amber",
  none: "slate",
};

const RATIONALE_PREVIEW_CHARS = 140;

function IcpCard({
  proposal,
  rank,
  chosen,
  onChoose,
  choosing,
}: {
  proposal: IcpProposal;
  rank: number;
  chosen: boolean;
  onChoose: () => void;
  choosing: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const rationale = proposal.rationale?.trim() ?? "";
  const needsReadMore = rationale.length > RATIONALE_PREVIEW_CHARS;
  const preview = needsReadMore
    ? `${rationale.slice(0, RATIONALE_PREVIEW_CHARS).trimEnd()}…`
    : rationale;

  return (
    <div
      className={`flex gap-4 rounded-xl border p-4 sm:p-5 ${
        chosen
          ? "border-sky-400 bg-sky-50/50 ring-1 ring-sky-200"
          : rank === 1
            ? "border-slate-200 bg-white shadow-sm"
            : "border-slate-200 bg-white"
      }`}
    >
      <div
        className={`flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-full text-sm font-semibold ${
          chosen
            ? "bg-sky-600 text-white"
            : rank === 1
              ? "bg-slate-900 text-white"
              : "bg-slate-100 text-slate-600"
        }`}
        aria-label={`Recommendation ${rank}`}
      >
        {rank}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            {rank === 1 && !chosen ? (
              <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-sky-700">
                Top recommendation
              </p>
            ) : null}
            <h4 className="text-base font-semibold text-slate-900">{proposal.label}</h4>
          </div>
          <Chip tone={SOURCING_TONE[proposal.sourcingRoute]}>
            {SOURCING_LABEL[proposal.sourcingRoute]}
          </Chip>
        </div>

        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-slate-600 sm:grid-cols-4">
          <div>
            <dt className="text-slate-400">Industry</dt>
            <dd className="font-medium text-slate-700">{proposal.industry || "—"}</dd>
          </div>
          <div>
            <dt className="text-slate-400">Geography</dt>
            <dd className="font-medium text-slate-700">{proposal.geography || "—"}</dd>
          </div>
          <div>
            <dt className="text-slate-400">Team size</dt>
            <dd className="font-medium text-slate-700">{proposal.teamSize || "—"}</dd>
          </div>
          <div>
            <dt className="text-slate-400">Revenue</dt>
            <dd className="font-medium text-slate-700">{proposal.revenueRange || "—"}</dd>
          </div>
        </dl>

        {proposal.roleTitles?.length ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {proposal.roleTitles.map((title) => (
              <Chip key={title}>{title}</Chip>
            ))}
          </div>
        ) : null}

        {rationale ? (
          <div className="mt-3">
            <p className="text-sm leading-relaxed text-slate-600">
              {expanded || !needsReadMore ? rationale : preview}
            </p>
            {needsReadMore ? (
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-sky-700 hover:text-sky-800"
              >
                {expanded ? (
                  <>
                    Show less <ChevronUp className="h-3.5 w-3.5" />
                  </>
                ) : (
                  <>
                    Why this fit <ChevronDown className="h-3.5 w-3.5" />
                  </>
                )}
              </button>
            ) : null}
          </div>
        ) : null}

        {proposal.inventoryNote ? (
          <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
            {typeof proposal.inventoryCount === "number"
              ? `${proposal.inventoryCount.toLocaleString()} in our database — `
              : ""}
            {proposal.inventoryNote}
          </p>
        ) : null}

        <div className="mt-4">
          {chosen ? (
            <span className="text-xs font-medium text-sky-700">Chosen ICP</span>
          ) : (
            <PrimaryButton onClick={onChoose} disabled={choosing} className="w-full sm:w-auto">
              {choosing ? "Starting…" : "Choose this ICP"}
            </PrimaryButton>
          )}
        </div>
      </div>
    </div>
  );
}

export function StepIcp({
  hasLinkedIn,
  icp,
  initialProposals,
  onChosen,
  onContinue,
}: {
  hasLinkedIn: boolean;
  icp: ChosenIcp | null;
  initialProposals?: IcpProposal[] | null;
  onChosen: (icp: ChosenIcp) => void;
  onContinue: () => void;
}) {
  const [proposals, setProposals] = useState<IcpProposal[] | null>(
    initialProposals?.length ? initialProposals : null
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<"pick" | "progress">("pick");
  const autoStarted = useRef(false);
  const progress = useCampaignProgressRunner();

  useEffect(() => {
    if (initialProposals?.length) {
      setProposals(initialProposals);
    }
  }, [initialProposals]);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    const result = await apiPost<ProposalsResponse>(
      "/api/coach/campaign-setup/icp-proposals"
    );
    setLoading(false);
    if (!result.ok || !result.data?.proposals?.length) {
      setError(
        result.error ??
          result.data?.error ??
          "Couldn't generate proposals right now. Try again shortly."
      );
      return;
    }
    setProposals(result.data.proposals);
  }

  useEffect(() => {
    if (autoStarted.current) return;
    if (!hasLinkedIn || icp || proposals?.length) return;
    autoStarted.current = true;
    void handleGenerate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasLinkedIn, icp, proposals]);

  async function handleChoose(proposal: IcpProposal) {
    setError(null);
    setPhase("progress");

    const chosenHolder: { icp: ChosenIcp | null } = { icp: null };

    try {
      await progress.runFlat([
        {
          id: "save",
          label: "Saving your ICP choice",
          minMs: 900,
          work: async () => {
            const result = await apiPost<ChooseIcpResponse>(
              "/api/coach/campaign-setup/icp",
              { ...proposal, generateProfile: false }
            );
            if (!result.ok) {
              throw new Error(result.error ?? "Couldn't save that ICP.");
            }
            chosenHolder.icp =
              result.data?.icp ?? {
                ...proposal,
                chosenAt: new Date().toISOString(),
              };
          },
        },
        {
          id: "profile",
          label: "Drafting your Ideal Client Profile outline",
          minMs: 1200,
        },
        {
          id: "library",
          label: "Pulling the closest avatar from our library",
          minMs: 1100,
        },
        {
          id: "adapt",
          label: "Adapting it to your market & proof",
          minMs: 1300,
        },
        {
          id: "handoff",
          label: "Opening your avatar for review",
          minMs: 700,
        },
      ]);

      if (!chosenHolder.icp) throw new Error("Couldn't save that ICP.");
      onChosen(chosenHolder.icp);
      await new Promise((r) => setTimeout(r, 400));
      onContinue();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save that ICP.");
      setPhase("pick");
    }
  }

  if (phase === "progress") {
    return (
      <div className="flex flex-col gap-5">
        <CampaignSetupProgress
          title="Locking in your ICP"
          subtitle="Next we’ll build the Ideal Client Profile and Avatar from this choice."
          stages={progress.stages}
        />
        {error ? <ErrorNote>{error}</ErrorNote> : null}
      </div>
    );
  }

  if (loading && !proposals?.length && !icp) {
    return (
      <div className="flex flex-col gap-5">
        <AiNote>
          Fit beats inventory. Pick the segment that matches your real expertise
          — the lead count just tells you how we&apos;ll build the list in step 5.
        </AiNote>
        <EmptyState
          title="Generating your ICP options…"
          description="Reading your LinkedIn history and matching against our library."
        />
      </div>
    );
  }

  const ranked =
    proposals?.map((proposal, idx) => ({ proposal, rank: idx + 1 })) ?? [];

  return (
    <div className="flex flex-col gap-5">
      <AiNote>
        Fit beats inventory. We&apos;ve ranked these by how well they match your
        LinkedIn history — #1 is our top recommendation. Choose one and we&apos;ll
        build the avatar next.
      </AiNote>

      {icp ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-slate-900">Your chosen ICP</p>
            <SecondaryButton onClick={() => void handleGenerate()} disabled={loading}>
              {loading ? "Regenerating…" : "See other options"}
            </SecondaryButton>
          </div>
          <IcpCard
            proposal={icp}
            rank={1}
            chosen
            onChoose={() => {}}
            choosing={false}
          />
        </div>
      ) : null}

      {!icp && !proposals ? (
        <EmptyState
          title="Generate your ICP options"
          description="We'll propose 2–3 target segments from your LinkedIn history and our house filter defaults."
          action={
            <PrimaryButton
              onClick={() => void handleGenerate()}
              loading={loading}
              disabled={!hasLinkedIn}
            >
              <Sparkles className="h-4 w-4" />
              Generate ICP proposals
            </PrimaryButton>
          }
        />
      ) : null}

      {error ? <ErrorNote>{error}</ErrorNote> : null}

      {proposals && !icp ? (
        <div className="flex flex-col gap-3">
          {ranked.map(({ proposal, rank }) => (
            <IcpCard
              key={proposal.label}
              proposal={proposal}
              rank={rank}
              chosen={false}
              choosing={false}
              onChoose={() => void handleChoose(proposal)}
            />
          ))}
        </div>
      ) : null}

      {proposals && icp ? (
        <div className="flex flex-col gap-3">
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-400">
            Other options
          </p>
          {ranked
            .filter(({ proposal }) => proposal.label !== icp.label)
            .map(({ proposal, rank }) => (
              <IcpCard
                key={proposal.label}
                proposal={proposal}
                rank={rank}
                chosen={false}
                choosing={false}
                onChoose={() => void handleChoose(proposal)}
              />
            ))}
        </div>
      ) : null}

      {icp ? (
        <div className="flex justify-end">
          <PrimaryButton onClick={onContinue}>Continue to Avatar</PrimaryButton>
        </div>
      ) : null}
    </div>
  );
}
