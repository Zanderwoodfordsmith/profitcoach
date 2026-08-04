"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { StickyPageHeader } from "@/components/layout";
import { CoachToolsHubTabs } from "@/components/layout/CoachToolsHubTabs";
import { CampaignStepPanel } from "@/components/firstCampaign/CampaignStepPanel";
import {
  FirstCampaignStepRail,
  type StepRailItem,
  type StepStatus,
} from "@/components/firstCampaign/FirstCampaignStepRail";
import { StepLinkedIn } from "@/components/firstCampaign/StepLinkedIn";
import { StepIcp } from "@/components/firstCampaign/StepIcp";
import { StepAvatar } from "@/components/firstCampaign/StepAvatar";
import { StepMessages } from "@/components/firstCampaign/StepMessages";
import { StepStarterList } from "@/components/firstCampaign/StepStarterList";
import type { CampaignStep, IcpProposal } from "@/lib/firstCampaign/types";
import {
  apiGet,
  apiPatch,
  EMPTY_CAMPAIGN_STATE,
  normalizeCampaignSetupState,
  type AvatarState,
  type CampaignSetupState,
  type ChosenIcp,
  type LeadListSummary,
  type LinkedInImportProfile,
  type MessagesState,
} from "@/lib/firstCampaign/wizardApi";

const STEP_META: {
  id: CampaignStep;
  label: string;
  title: string;
  description: string;
  railHint: string;
}[] = [
  {
    id: 1,
    label: "LinkedIn",
    title: "LinkedIn",
    description:
      "Import your profile so we can ground the campaign in your real background.",
    railHint: "Import your profile",
  },
  {
    id: 2,
    label: "Choose ICP",
    title: "Choose your ICP",
    description: "Pick the market you’ll go after first — fit beats inventory.",
    railHint: "Pick your target market",
  },
  {
    id: 3,
    label: "Ideal Client",
    title: "Ideal Client",
    description:
      "Confirm the Profile section by section, then lock it before we build the Avatar.",
    railHint: "Profile → Avatar",
  },
  {
    id: 4,
    label: "Messages",
    title: "Messages",
    description:
      "Draft outreach that uses the Ideal Client language you just locked.",
    railHint: "Draft your outreach",
  },
  {
    id: 5,
    label: "Starter list",
    title: "Starter list",
    description: "Build your first warm or cold prospect list for this campaign.",
    railHint: "Build your first list",
  },
];

export function FirstCampaignWizard() {
  const [loading, setLoading] = useState(true);
  const [linkedin, setLinkedin] = useState<LinkedInImportProfile | null>(null);
  const [setup, setSetup] = useState<CampaignSetupState>(EMPTY_CAMPAIGN_STATE);
  const [activeStep, setActiveStep] = useState<CampaignStep>(1);
  const [icpProposals, setIcpProposals] = useState<IcpProposal[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [linkedinResult, setupResult] = await Promise.all([
        apiGet<{ profile?: LinkedInImportProfile }>("/api/coach/linkedin/profile"),
        apiGet<unknown>("/api/coach/campaign-setup"),
      ]);
      if (cancelled) return;
      const importedProfile = linkedinResult.data?.profile ?? null;
      setLinkedin(importedProfile);
      const normalized = setupResult.ok
        ? normalizeCampaignSetupState(setupResult.data)
        : EMPTY_CAMPAIGN_STATE;
      setSetup(normalized);
      setActiveStep(
        computeInitialStep(importedProfile, normalized)
      );
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const completed = useMemo(
    () => ({
      1: Boolean(linkedin),
      2: Boolean(setup.icp),
      3: Boolean(setup.avatar?.approvedAt),
      4: Boolean(setup.messages?.approvedAt),
      5: Boolean(setup.leadList),
    }),
    [linkedin, setup]
  );

  const maxUnlocked = useMemo<CampaignStep>(() => {
    let m: CampaignStep = 1;
    for (const step of STEP_META) {
      if (completed[step.id]) {
        m = (Math.min(5, step.id + 1) as CampaignStep);
      }
    }
    return m;
  }, [completed]);

  const railItems: StepRailItem[] = STEP_META.map((step) => {
    let status: StepStatus;
    if (completed[step.id]) status = "complete";
    else if (step.id === activeStep) status = "active";
    else if (step.id <= maxUnlocked) status = "available";
    else status = "locked";
    return {
      id: step.id,
      label: step.label,
      description: step.railHint,
      status,
    };
  });

  const persistStep = useCallback((step: CampaignStep) => {
    void apiPatch("/api/coach/campaign-setup", { currentStep: step });
  }, []);

  const goToStep = useCallback(
    (step: CampaignStep) => {
      setActiveStep(step);
      persistStep(step);
    },
    [persistStep]
  );

  function handleLinkedinImported(profile: LinkedInImportProfile) {
    setLinkedin(profile);
  }

  function handleProposalsReady(proposals: IcpProposal[]) {
    setIcpProposals(proposals);
  }

  function handleIcpChosen(icp: ChosenIcp) {
    setSetup((prev) => ({ ...prev, icp, avatar: null, messages: null }));
  }

  function handleAvatarSaved(avatar: AvatarState) {
    setSetup((prev) => ({ ...prev, avatar }));
  }

  function handleMessagesSaved(messages: MessagesState) {
    setSetup((prev) => ({ ...prev, messages }));
  }

  function handleLeadListSaved(leadList: LeadListSummary) {
    setSetup((prev) => ({ ...prev, leadList }));
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <StickyPageHeader title="Get Clients" tabs={<CoachToolsHubTabs hub="get-clients" />} />
        <p className="px-1 text-sm text-slate-500">Loading your campaign setup…</p>
      </div>
    );
  }

  const activeMeta = STEP_META.find((s) => s.id === activeStep) ?? STEP_META[0]!;

  return (
    <div className="flex flex-col gap-4">
      <StickyPageHeader
        title="First Campaign"
        description="A guided setup that takes you from ‘I've joined’ to a working outreach campaign — LinkedIn, ICP, avatar, messages, and a starter list."
        tabs={<CoachToolsHubTabs hub="get-clients" />}
      />

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[15rem_1fr] lg:gap-8">
        <aside className="lg:sticky lg:top-24 lg:h-fit">
          <FirstCampaignStepRail items={railItems} onSelect={goToStep} />
        </aside>

        <div className="min-w-0 pt-1 lg:pt-0">
          <CampaignStepPanel
            step={activeMeta.id}
            title={activeMeta.title}
            description={activeMeta.description}
          >
            {activeStep === 1 ? (
              <StepLinkedIn
                linkedin={linkedin}
                onImported={handleLinkedinImported}
                onProposalsReady={handleProposalsReady}
                onContinue={() => goToStep(2)}
              />
            ) : null}
            {activeStep === 2 ? (
              <StepIcp
                hasLinkedIn={Boolean(linkedin)}
                icp={setup.icp}
                initialProposals={icpProposals}
                onChosen={handleIcpChosen}
                onContinue={() => goToStep(3)}
              />
            ) : null}
            {activeStep === 3 ? (
              <StepAvatar
                icp={setup.icp}
                avatar={setup.avatar}
                onSaved={handleAvatarSaved}
                onContinue={() => goToStep(4)}
              />
            ) : null}
            {activeStep === 4 ? (
              <StepMessages
                icp={setup.icp}
                avatar={setup.avatar}
                messages={setup.messages}
                onSaved={handleMessagesSaved}
                onContinue={() => goToStep(5)}
              />
            ) : null}
            {activeStep === 5 ? (
              <StepStarterList
                icp={setup.icp}
                leadList={setup.leadList}
                onSaved={handleLeadListSaved}
              />
            ) : null}
          </CampaignStepPanel>
        </div>
      </div>
    </div>
  );
}

function computeInitialStep(
  linkedin: LinkedInImportProfile | null,
  setup: CampaignSetupState
): CampaignStep {
  if (setup.leadList) return 5;
  if (setup.messages?.approvedAt) return 5;
  if (setup.avatar?.approvedAt) return 4;
  if (setup.icp) return 3;
  if (linkedin) return 2;
  return 1;
}
