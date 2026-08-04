"use client";

import { useEffect, useRef, useState } from "react";
import { Linkedin, Users2 } from "lucide-react";
import {
  AiNote,
  Card,
  Chip,
  ErrorNote,
  PrimaryButton,
} from "@/components/firstCampaign/firstCampaignUi";
import {
  CampaignSetupProgress,
  runProgressStage,
  type ProgressStage,
} from "@/components/firstCampaign/CampaignSetupProgress";
import type { IcpProposal } from "@/lib/firstCampaign/types";
import {
  apiPatch,
  apiPost,
  type LinkedInImportProfile,
} from "@/lib/firstCampaign/wizardApi";

type ImportResponse = {
  profile?: LinkedInImportProfile;
  error?: string;
  retryAfterSec?: number;
};

type ProposalsResponse = { proposals?: IcpProposal[]; error?: string };

const BOOTSTRAP_STAGES: { id: string; label: string }[] = [
  { id: "scrape", label: "Scraping LinkedIn profile" },
  { id: "analyse", label: "Analysing LinkedIn profile" },
  { id: "experience", label: "Mapping your experience & industries" },
  { id: "library", label: "Matching against our ICP library" },
  { id: "proposals", label: "Generating ICP proposals" },
  { id: "prepare", label: "Preparing your options" },
];

function initialStages(): ProgressStage[] {
  return BOOTSTRAP_STAGES.map((s) => ({
    ...s,
    status: "pending",
    progress: 0,
  }));
}

export function StepLinkedIn({
  linkedin,
  onImported,
  onProposalsReady,
  onContinue,
}: {
  linkedin: LinkedInImportProfile | null;
  onImported: (profile: LinkedInImportProfile) => void;
  onProposalsReady: (proposals: IcpProposal[]) => void;
  onContinue: () => void;
}) {
  const [url, setUrl] = useState(linkedin?.linkedinUrl ?? "");
  const [bootstrapping, setBootstrapping] = useState(false);
  const [stages, setStages] = useState<ProgressStage[]>(initialStages);
  const [error, setError] = useState<string | null>(null);
  const cancelRef = useRef({ cancelled: false });

  useEffect(() => {
    return () => {
      cancelRef.current.cancelled = true;
    };
  }, []);

  function patchStage(
    index: number,
    patch: Partial<Pick<ProgressStage, "status" | "progress">>
  ) {
    setStages((prev) =>
      prev.map((s, i) => (i === index ? { ...s, ...patch } : s))
    );
  }

  async function advanceStage(
    index: number,
    opts: { minMs: number; work?: Promise<unknown> }
  ) {
    patchStage(index, { status: "active", progress: 0 });
    try {
      await runProgressStage({
        minMs: opts.minMs,
        work: opts.work,
        signal: cancelRef.current,
        onProgress: (pct) => patchStage(index, { progress: pct }),
      });
      patchStage(index, { status: "done", progress: 100 });
    } catch (err) {
      patchStage(index, { status: "error", progress: 100 });
      throw err;
    }
  }

  async function handleImport() {
    cancelRef.current = { cancelled: false };
    setBootstrapping(true);
    setStages(initialStages());
    setError(null);

    try {
      // Stage 0 — real scrape
      const scrapeHolder: { profile: LinkedInImportProfile | null } = {
        profile: null,
      };
      const scrapeWork = (async () => {
        const result = await apiPost<ImportResponse>("/api/coach/linkedin/profile", {
          linkedinUrl: url.trim() || undefined,
        });
        if (!result.ok || !result.data?.profile) {
          throw new Error(
            result.error ??
              result.data?.error ??
              "Couldn't import this profile. Check the URL and try again."
          );
        }
        scrapeHolder.profile = result.data.profile;
      })();

      await advanceStage(0, { minMs: 1800, work: scrapeWork });
      const imported = scrapeHolder.profile;
      if (!imported) throw new Error("Import failed.");

      onImported(imported);
      if (!url.trim()) setUrl(imported.linkedinUrl);

      void apiPatch("/api/coach/campaign-setup", {
        markStepComplete: 1,
        currentStep: 2,
      });

      // Kick proposals as soon as scrape lands — overlaps cosmetic stages
      let proposals: IcpProposal[] = [];
      const proposalsWork = (async () => {
        const result = await apiPost<ProposalsResponse>(
          "/api/coach/campaign-setup/icp-proposals"
        );
        if (!result.ok || !result.data?.proposals?.length) {
          throw new Error(
            result.error ??
              result.data?.error ??
              "Couldn't generate ICP proposals. You can retry on the next step."
          );
        }
        proposals = result.data.proposals;
      })();

      // Stages 1–3 — perceived analysis (cosmetic, overlapping proposals)
      await advanceStage(1, { minMs: 1100 });
      await advanceStage(2, { minMs: 1200 });
      await advanceStage(3, { minMs: 1000 });

      // Stage 4 — wait for proposals if still running
      await advanceStage(4, { minMs: 1400, work: proposalsWork });

      await advanceStage(5, { minMs: 700 });

      onProposalsReady(proposals);

      // Brief beat so the final checkmarks land, then advance
      await new Promise((r) => setTimeout(r, 450));
      onContinue();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Something went wrong. Try again.";
      setError(message);
      setBootstrapping(false);
    }
  }

  const snapshot = linkedin?.snapshot;
  const topExperiences = (snapshot?.experiences ?? []).slice(0, 4);

  if (bootstrapping) {
    return (
      <div className="flex flex-col gap-5">
        <CampaignSetupProgress
          title="Building your first campaign"
          subtitle="Scraping your profile and preparing ICP options…"
          stages={stages}
        />
        {error ? <ErrorNote>{error}</ErrorNote> : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <AiNote>
        Paste your public LinkedIn profile URL. We&apos;ll scrape it, analyse
        your background, and prepare ICP options — then take you straight to
        choose.
      </AiNote>

      <Card title="Your LinkedIn profile">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label htmlFor="linkedin-url" className="sr-only">
              LinkedIn profile URL
            </label>
            <input
              id="linkedin-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.linkedin.com/in/yourname"
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
            />
          </div>
          <PrimaryButton onClick={() => void handleImport()}>
            {snapshot ? "Re-import & analyse" : "Import & analyse"}
          </PrimaryButton>
        </div>
        {error ? (
          <div className="mt-3">
            <ErrorNote>{error}</ErrorNote>
          </div>
        ) : null}
      </Card>

      {snapshot ? (
        <Card
          title="Snapshot"
          description={
            linkedin?.scrapedAt
              ? `Imported ${new Date(linkedin.scrapedAt).toLocaleDateString()}`
              : undefined
          }
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            {snapshot.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={snapshot.photoUrl}
                alt={snapshot.fullName ?? "Profile photo"}
                className="h-16 w-16 shrink-0 rounded-full border border-slate-200 object-cover"
              />
            ) : (
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                <Linkedin className="h-6 w-6" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="font-medium text-slate-900">
                {snapshot.fullName ?? "—"}
              </p>
              {snapshot.headline ? (
                <p className="mt-0.5 text-sm text-slate-600">{snapshot.headline}</p>
              ) : null}
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                {snapshot.location ? <span>{snapshot.location}</span> : null}
                {typeof snapshot.connectionsCount === "number" ? (
                  <span className="inline-flex items-center gap-1">
                    <Users2 className="h-3.5 w-3.5" />
                    {snapshot.connectionsCount.toLocaleString()} connections
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          {topExperiences.length > 0 ? (
            <div className="mt-4">
              <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.1em] text-slate-400">
                Recent roles
              </p>
              <div className="flex flex-wrap gap-1.5">
                {topExperiences.map((exp, idx) => (
                  <Chip key={idx} tone="slate">
                    {[exp.title, exp.company].filter(Boolean).join(" @ ")}
                  </Chip>
                ))}
              </div>
            </div>
          ) : null}

          {snapshot.skills.length > 0 ? (
            <div className="mt-4">
              <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.1em] text-slate-400">
                Skills
              </p>
              <div className="flex flex-wrap gap-1.5">
                {snapshot.skills.slice(0, 10).map((skill) => (
                  <Chip key={skill} tone="sky">
                    {skill}
                  </Chip>
                ))}
              </div>
            </div>
          ) : null}
        </Card>
      ) : null}

      {snapshot ? (
        <div className="flex justify-end gap-2">
          <PrimaryButton
            onClick={() => {
              // Already imported — jump to ICP without re-scrape
              onContinue();
            }}
          >
            Continue to ICP
          </PrimaryButton>
        </div>
      ) : null}
    </div>
  );
}
