"use client";

import { useEffect, useRef, useState } from "react";
import {
  AiNote,
  Card,
  ErrorNote,
  PrimaryButton,
  SecondaryButton,
} from "@/components/firstCampaign/firstCampaignUi";
import {
  CampaignSetupProgress,
  useCampaignProgressRunner,
  type ProgressStageDef,
} from "@/components/firstCampaign/CampaignSetupProgress";
import {
  CollapsedSectionRow,
  InteractiveLineList,
  ProfileReviewShell,
  ProfileSectionStepper,
  SectionConfirmCard,
  TextArea,
  type SectionConfirmStatus,
} from "@/components/firstCampaign/SectionConfirmCard";
import {
  CAMPAIGN_BRAIN_KEYS,
  type AvatarPayload,
  type CampaignBrainKey,
  type IdealClientProfilePayload,
  type LabelledPoint,
} from "@/lib/firstCampaign/types";
import {
  apiPatch,
  apiPost,
  type AvatarState,
  type ChosenIcp,
} from "@/lib/firstCampaign/wizardApi";

type ProfileResponse = {
  profile?: IdealClientProfilePayload;
  locked?: boolean;
  error?: string;
};
type AvatarGenerateResponse = {
  profile?: IdealClientProfilePayload;
  avatar?: AvatarPayload;
  error?: string;
};
type SaveResponse = { avatar?: AvatarState; error?: string };

type Phase =
  | "profile_progress"
  | "profile_review"
  | "research_progress"
  | "avatar_progress"
  | "avatar_review"
  | "saving";

type ResearchPainsResponse = {
  quotes?: { text: string; sourceLabel?: string; url?: string }[];
  snippetsUsed?: number;
  providers?: string[];
  warning?: string;
  error?: string;
};

const BRAIN_KEY_LABEL: Record<CampaignBrainKey, string> = {
  ideal_client: "Ideal client",
  industry_vocabulary: "Industry vocabulary",
  pain_language: "Pain language",
  messaging_hooks: "Messaging hooks",
  proof_framing: "Proof framing",
};

const BRAIN_KEY_HINT: Record<CampaignBrainKey, string> = {
  ideal_client: "Who you target — market, titles, size, revenue.",
  industry_vocabulary: "The trade words this ICP actually uses.",
  pain_language: "Their pains and frustrations, in their own words.",
  messaging_hooks: "Openers and angles proven to land with this ICP.",
  proof_framing: "How your proof / results should be framed for them.",
};

const PROFILE_SECTIONS = [
  "market",
  "pains",
  "dreams",
  "fit",
  "positioning",
] as const;
type ProfileSectionId = (typeof PROFILE_SECTIONS)[number];

const PROFILE_STEP_META: { id: ProfileSectionId; label: string; title: string }[] = [
  { id: "market", label: "Market", title: "Target market" },
  { id: "pains", label: "Pains", title: "Pains — in their words" },
  { id: "dreams", label: "Dreams", title: "Dreams / desired outcomes" },
  { id: "fit", label: "Not a fit", title: "Not a fit" },
  { id: "positioning", label: "Positioning", title: "Your positioning" },
];

const AVATAR_SECTIONS = ["persona", "problem", "hooks"] as const;
type AvatarSectionId = (typeof AVATAR_SECTIONS)[number];

function pointsToLines(points: LabelledPoint[] | undefined): string[] {
  if (!points?.length) return [];
  return points.map((p) => (p.label ? `${p.label}: ${p.text}` : p.text));
}

function linesToPoints(lines: string[]): LabelledPoint[] {
  return lines.map((line) => {
    const idx = line.indexOf(":");
    if (idx > 0 && idx < 40) {
      return { label: line.slice(0, idx).trim(), text: line.slice(idx + 1).trim() };
    }
    return { text: line };
  });
}

function Bullets({ points }: { points: LabelledPoint[] | undefined }) {
  if (!points?.length) return <p className="text-[15px] text-slate-400">—</p>;
  return (
    <ul className="space-y-2.5">
      {points.map((p, idx) => (
        <li
          key={idx}
          className="flex gap-3 rounded-xl border border-white/80 bg-white/60 px-3.5 py-3 text-[15px] leading-relaxed text-slate-700"
        >
          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-500/70" aria-hidden />
          <span>
            {p.label ? <span className="font-semibold text-slate-900">{p.label}: </span> : null}
            {p.text}
          </span>
        </li>
      ))}
    </ul>
  );
}

function initialStatuses<T extends string>(
  ids: readonly T[],
  allConfirmed: boolean
): Record<T, SectionConfirmStatus> {
  return Object.fromEntries(
    ids.map((id) => [id, allConfirmed ? "confirmed" : "pending"])
  ) as Record<T, SectionConfirmStatus>;
}

export function StepAvatar({
  icp,
  avatar,
  onSaved,
  onContinue,
  afterSave = "messages",
}: {
  icp: ChosenIcp | null;
  avatar: AvatarState | null;
  onSaved: (avatar: AvatarState) => void;
  onContinue: () => void;
  /** Full campaign hands off to messages; isolated Ideal Client just saves. */
  afterSave?: "messages" | "done";
}) {
  const hasApprovedAvatar = Boolean(avatar?.approvedAt && (avatar.edited || avatar.generated));

  const [phase, setPhase] = useState<Phase>(() => {
    if (hasApprovedAvatar) return "avatar_review";
    if (avatar?.edited || avatar?.generated) return "avatar_review";
    if (avatar?.profile?.targetMarket) return "profile_review";
    return "profile_progress";
  });
  const [error, setError] = useState<string | null>(null);
  const autoStarted = useRef(false);
  const progress = useCampaignProgressRunner();

  const [profile, setProfile] = useState<IdealClientProfilePayload | null>(
    avatar?.profile ?? null
  );
  const [generatedAvatar, setGeneratedAvatar] = useState<AvatarPayload | null>(
    avatar?.edited ?? avatar?.generated ?? null
  );

  const [profileStatus, setProfileStatus] = useState<
    Record<ProfileSectionId, SectionConfirmStatus>
  >(() => initialStatuses(PROFILE_SECTIONS, Boolean(avatar?.approvedAt)));
  const [activeProfileStep, setActiveProfileStep] = useState(0);
  const [painsResearched, setPainsResearched] = useState(false);
  const [researchNote, setResearchNote] = useState<string | null>(null);
  const [painsListKey, setPainsListKey] = useState(0);
  const [avatarStatus, setAvatarStatus] = useState<
    Record<AvatarSectionId, SectionConfirmStatus>
  >(() =>
    initialStatuses(AVATAR_SECTIONS, Boolean(avatar?.approvedAt))
  );

  // Edit drafts
  const [painLines, setPainLines] = useState<string[]>([]);
  const [dreamLines, setDreamLines] = useState<string[]>([]);
  const [notAFitLines, setNotAFitLines] = useState<string[]>([]);
  const [positioning, setPositioning] = useState("");
  const [marketIndustry, setMarketIndustry] = useState("");
  const [marketGeo, setMarketGeo] = useState("");
  const [marketTeam, setMarketTeam] = useState("");
  const [marketRevenue, setMarketRevenue] = useState("");
  const [roleTitlesText, setRoleTitlesText] = useState("");

  const [personaHeadline, setPersonaHeadline] = useState("");
  const [personaName, setPersonaName] = useState("");
  const [personaOcc, setPersonaOcc] = useState("");
  const [specificProblem, setSpecificProblem] = useState("");
  const [personaQuote, setPersonaQuote] = useState("");
  const [hooksText, setHooksText] = useState("");
  const [showMoreAvatar, setShowMoreAvatar] = useState(false);

  const [selectedKeys, setSelectedKeys] = useState<Set<CampaignBrainKey>>(
    new Set(avatar?.savedBrainKeys?.length ? avatar.savedBrainKeys : CAMPAIGN_BRAIN_KEYS)
  );

  function hydrateProfileEditors(p: IdealClientProfilePayload) {
    setMarketIndustry(p.targetMarket?.industry ?? "");
    setMarketGeo(p.targetMarket?.geography ?? "");
    setMarketTeam(p.targetMarket?.teamSize ?? "");
    setMarketRevenue(p.targetMarket?.revenueRange ?? "");
    setRoleTitlesText((p.decisionMaker?.roleTitles ?? []).join(", "));
    const painPts =
      p.frustrationsTheySayOutLoud?.map((t) => ({ text: t })) ??
      p.corePainPoints?.flatMap((g) => g.points) ??
      [];
    setPainLines(pointsToLines(painPts));
    setDreamLines(pointsToLines(p.desiredOutcomes));
    setNotAFitLines(p.notAFit ?? []);
    setPositioning(p.coachPositioning?.positioningStatement ?? "");
  }

  function hydrateAvatarEditors(a: AvatarPayload) {
    setPersonaHeadline(a.persona.headline ?? "");
    setPersonaName(a.persona.personaName ?? "");
    setPersonaOcc(a.persona.demographics?.occupation ?? "");
    setSpecificProblem(a.persona.specificProblem?.text ?? "");
    setPersonaQuote(a.persona.quote ?? "");
    setHooksText((a.messagingHooks ?? a.mainDesires ?? []).join("\n"));
  }

  function applyProfileEditsToState(base: IdealClientProfilePayload): IdealClientProfilePayload {
    const painPoints = linesToPoints(painLines);
    return {
      ...base,
      targetMarket: {
        ...base.targetMarket,
        industry: marketIndustry.trim() || base.targetMarket.industry,
        geography: marketGeo.trim() || base.targetMarket.geography,
        teamSize: marketTeam.trim() || base.targetMarket.teamSize,
        revenueRange: marketRevenue.trim() || base.targetMarket.revenueRange,
      },
      decisionMaker: {
        ...base.decisionMaker,
        roleTitles: roleTitlesText
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      },
      frustrationsTheySayOutLoud: painLines,
      corePainPoints: [
        {
          theme: "In their words",
          points: painPoints,
        },
      ],
      desiredOutcomes: linesToPoints(dreamLines),
      notAFit: notAFitLines,
      coachPositioning: {
        positioningStatement: positioning,
        whyThisCoach: base.coachPositioning?.whyThisCoach ?? [],
        messagingHooks: base.coachPositioning?.messagingHooks ?? [],
      },
    };
  }

  function applyAvatarEditsToState(base: AvatarPayload): AvatarPayload {
    return {
      ...base,
      persona: {
        ...base.persona,
        headline: personaHeadline,
        personaName: personaName,
        demographics: {
          ...base.persona.demographics,
          occupation: personaOcc,
        },
        specificProblem: {
          ...base.persona.specificProblem,
          text: specificProblem,
          isQuoted: true,
        },
        quote: personaQuote,
      },
      messagingHooks: hooksText
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
    };
  }

  async function runWithProgress(defs: ProgressStageDef[], next: Phase): Promise<boolean> {
    setError(null);
    try {
      await progress.runFlat(defs);
      await new Promise((r) => setTimeout(r, 300));
      setPhase(next);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      return false;
    }
  }

  async function generateProfile(opts?: { force?: boolean }) {
    if (!icp) {
      setError("Choose an ICP first.");
      return;
    }
    setPhase("profile_progress");

    const holder: { profile: IdealClientProfilePayload | null } = { profile: null };
    const work = (async () => {
      const result = await apiPost<ProfileResponse>("/api/coach/campaign-setup/profile", {
        icpId: icp.id,
        icp,
        force: opts?.force ?? false,
      });
      if (!result.ok || !result.data?.profile) {
        throw new Error(result.error ?? result.data?.error ?? "Couldn't generate the profile.");
      }
      holder.profile = result.data.profile;
    })();
    void work.catch(() => undefined);

    await runWithProgress(
      [
        { id: "market", label: "Defining the target market", minMs: 1000 },
        { id: "scaffold", label: "Drafting dreams, fit & positioning", minMs: 1200, work: () => work },
        { id: "ready", label: "Preparing your market review", minMs: 600 },
      ],
      "profile_review"
    );

    if (holder.profile) {
      setProfile(holder.profile);
      hydrateProfileEditors(holder.profile);
      setProfileStatus(initialStatuses(PROFILE_SECTIONS, false));
      setActiveProfileStep(0);
      setPainsResearched(false);
      setResearchNote(null);
    }
  }

  async function researchPainsForMarket(opts?: { force?: boolean }) {
    if (!profile) return;
    if (painsResearched && !opts?.force) {
      setActiveProfileStep(1);
      setPhase("profile_review");
      return;
    }

    setPhase("research_progress");
    setError(null);
    setResearchNote(null);

    const edited = applyProfileEditsToState(profile);
    setProfile(edited);

    const holder: { quotes: string[]; note: string | null } = {
      quotes: [],
      note: null,
    };

    const work = (async () => {
      const result = await apiPost<ResearchPainsResponse>(
        "/api/coach/campaign-setup/research-pains",
        {
          industry: edited.targetMarket.industry,
          roleTitles: edited.decisionMaker.roleTitles,
          geography: edited.targetMarket.geography,
          teamSize: edited.targetMarket.teamSize,
        }
      );
      if (!result.ok) {
        throw new Error(result.error ?? "Couldn't research market language.");
      }
      const quotes = (result.data?.quotes ?? [])
        .map((q) => q.text.trim())
        .filter(Boolean);
      holder.quotes = quotes;
      if (result.data?.warning) holder.note = result.data.warning;
      else if (quotes.length) {
        holder.note = `Pulled ${quotes.length} candidate quotes from public Reddit discussions${
          result.data?.snippetsUsed
            ? ` (${result.data.snippetsUsed} threads scanned)`
            : ""
        }. Keep what sounds right.`;
      }
    })();
    void work.catch(() => undefined);

    const ok = await runWithProgress(
      [
        {
          id: "search",
          label: "Searching Reddit for real market language",
          minMs: 1200,
          work: () => work,
        },
        { id: "extract", label: "Extracting pains in their words", minMs: 900 },
        { id: "ready", label: "Ready for your review", minMs: 500 },
      ],
      "profile_review"
    );

    if (!ok) return;

    if (holder.quotes.length) {
      setPainLines(holder.quotes);
      setPainsResearched(true);
      setPainsListKey((k) => k + 1);
    } else {
      setPainsResearched(true);
    }
    if (holder.note) setResearchNote(holder.note);
    setActiveProfileStep(1);
    setProfileStatus((s) => ({ ...s, market: "confirmed", pains: "pending" }));
  }

  useEffect(() => {
    if (autoStarted.current) return;
    if (!icp) return;
    if (generatedAvatar || profile) return;
    autoStarted.current = true;
    void generateProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [icp]);

  useEffect(() => {
    if (profile) hydrateProfileEditors(profile);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (generatedAvatar) hydrateAvatarEditors(generatedAvatar);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const profileAllConfirmed = PROFILE_SECTIONS.every(
    (id) => profileStatus[id] === "confirmed"
  );
  const avatarAllConfirmed = AVATAR_SECTIONS.every(
    (id) => avatarStatus[id] === "confirmed"
  );

  async function lockProfileAndGenerateAvatar() {
    if (!icp || !profile) return;
    setError(null);

    const edited = applyProfileEditsToState(profile);
    setProfile(edited);
    setPhase("avatar_progress");

    const lockWork = (async () => {
      const lockResult = await apiPatch<ProfileResponse>(
        "/api/coach/campaign-setup/profile",
        { icpId: icp.id, profile: edited, lock: true }
      );
      if (!lockResult.ok) {
        throw new Error(lockResult.error ?? "Couldn't lock the profile.");
      }
    })();

    const avatarHolder: { avatar: AvatarPayload | null; profile: IdealClientProfilePayload | null } =
      { avatar: null, profile: edited };

    const avatarWork = (async () => {
      await lockWork;
      const result = await apiPost<AvatarGenerateResponse>(
        "/api/coach/campaign-setup/avatar",
        { icpId: icp.id, icp }
      );
      if (!result.ok || !result.data?.avatar) {
        throw new Error(
          result.error ?? result.data?.error ?? "Couldn't generate the avatar."
        );
      }
      avatarHolder.avatar = result.data.avatar;
      if (result.data.profile) avatarHolder.profile = result.data.profile;
    })();
    void avatarWork.catch(() => undefined);

    try {
      await progress.runFlat([
        { id: "lock", label: "Saving your confirmed profile", minMs: 900, work: () => lockWork },
        {
          id: "persona",
          label: "Building the human persona from your edits",
          minMs: 1400,
          work: () => avatarWork,
        },
        { id: "voice", label: "Writing their problem in their words", minMs: 1000 },
        { id: "hooks", label: "Crafting messaging hooks", minMs: 900 },
        { id: "ready", label: "Preparing avatar review", minMs: 600 },
      ]);
      if (!avatarHolder.avatar) throw new Error("Couldn't generate the avatar.");
      setGeneratedAvatar(avatarHolder.avatar);
      hydrateAvatarEditors(avatarHolder.avatar);
      if (avatarHolder.profile) {
        setProfile(avatarHolder.profile);
        hydrateProfileEditors(avatarHolder.profile);
      }
      setAvatarStatus(initialStatuses(AVATAR_SECTIONS, false));
      await new Promise((r) => setTimeout(r, 300));
      setPhase("avatar_review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't generate the avatar.");
      setPhase("profile_review");
    }
  }

  function toggleKey(key: CampaignBrainKey) {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function handleFinalConfirm() {
    if (!generatedAvatar || !profile) return;
    setError(null);
    setPhase("saving");

    const editedAvatar = applyAvatarEditsToState(generatedAvatar);
    const editedProfile = applyProfileEditsToState(profile);

    const savedHolder: { avatar: AvatarState | null } = { avatar: null };

    try {
      await progress.runFlat([
        {
          id: "brain",
          label: "Saving selected slices to your brain",
          minMs: 1200,
          work: async () => {
            const result = await apiPatch<SaveResponse>(
              "/api/coach/campaign-setup/avatar",
              {
                profile: editedProfile,
                avatar: editedAvatar,
                saveToBrain: Array.from(selectedKeys),
                approve: true,
              }
            );
            if (!result.ok) throw new Error(result.error ?? "Couldn't save.");
            savedHolder.avatar =
              result.data?.avatar ?? {
                profile: editedProfile,
                generated: generatedAvatar,
                edited: editedAvatar,
                approvedAt: new Date().toISOString(),
                savedBrainKeys: Array.from(selectedKeys),
              };
          },
        },
        ...(afterSave === "messages"
          ? [
              { id: "messages", label: "Warming up outreach drafts", minMs: 900 },
              { id: "handoff", label: "Opening messages", minMs: 600 },
            ]
          : [{ id: "handoff", label: "Saving your Ideal Client", minMs: 600 }]),
      ]);

      if (!savedHolder.avatar) throw new Error("Couldn't save.");
      onSaved(savedHolder.avatar);
      await new Promise((r) => setTimeout(r, 350));
      if (afterSave === "messages") {
        onContinue();
      } else {
        setPhase("avatar_review");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save.");
      setPhase("avatar_review");
    }
  }

  if (phase === "profile_progress" || phase === "avatar_progress" || phase === "saving" || phase === "research_progress") {
    return (
      <div className="flex flex-col gap-5">
        <CampaignSetupProgress
          title={
            phase === "profile_progress"
              ? "Drafting your Ideal Client Profile"
              : phase === "research_progress"
                ? "Researching pains in their words"
              : phase === "avatar_progress"
                ? "Building your Avatar from the confirmed Profile"
                : "Saving to your brain"
          }
          subtitle={
            phase === "research_progress"
              ? "Scanning public Reddit discussions for language that sounds like this market — not inventing coaching-speak."
              : phase === "avatar_progress"
                ? "Using the Profile you just locked — not the raw first draft."
                : icp
                  ? `Built for “${icp.label}”.`
                  : "This usually takes under a minute."
          }
          stages={progress.stages}
        />
        {error ? (
          <div className="flex flex-col gap-3">
            <ErrorNote>{error}</ErrorNote>
            <PrimaryButton
              onClick={() =>
                void (phase === "avatar_progress"
                  ? lockProfileAndGenerateAvatar()
                  : phase === "research_progress"
                    ? researchPainsForMarket({ force: true })
                    : generateProfile({ force: true }))
              }
            >
              Try again
            </PrimaryButton>
          </div>
        ) : null}
      </div>
    );
  }

  if (!icp) {
    return (
      <AiNote>Choose an ICP in step 2 first — then we&apos;ll build the Ideal Client.</AiNote>
    );
  }

  if (phase === "profile_review" && profile) {
    const confirmAndAdvance = (id: ProfileSectionId) => {
      setProfile(applyProfileEditsToState(profile));
      setProfileStatus((s) => ({ ...s, [id]: "confirmed" }));
      const idx = PROFILE_SECTIONS.indexOf(id);
      if (id === "market") {
        void researchPainsForMarket({ force: true });
        return;
      }
      if (idx >= 0 && idx < PROFILE_SECTIONS.length - 1) {
        setActiveProfileStep(idx + 1);
      }
    };

    const stepId = PROFILE_SECTIONS[activeProfileStep] ?? "market";
    const showLockFooter =
      profileAllConfirmed || stepId === "positioning";

    const selectStep = (index: number) => {
      const target = PROFILE_SECTIONS[index];
      if (!target) return;
      const priorOk = PROFILE_SECTIONS.slice(0, index).every(
        (id) => profileStatus[id] === "confirmed"
      );
      if (
        index <= activeProfileStep ||
        priorOk ||
        profileStatus[target] === "confirmed"
      ) {
        setActiveProfileStep(index);
      }
    };

    const sectionSummary = (id: ProfileSectionId): string => {
      switch (id) {
        case "market":
          return [
            marketIndustry || profile.targetMarket.industry,
            marketGeo || profile.targetMarket.geography,
          ]
            .filter(Boolean)
            .join(" · ");
        case "pains":
          return painLines.length
            ? `${painLines.length} pain${painLines.length === 1 ? "" : "s"} confirmed`
            : "No pains yet";
        case "dreams":
          return dreamLines.length
            ? `${dreamLines.length} outcome${dreamLines.length === 1 ? "" : "s"}`
            : "No outcomes yet";
        case "fit":
          return notAFitLines.length
            ? `${notAFitLines.length} filter${notAFitLines.length === 1 ? "" : "s"}`
            : "No filters yet";
        case "positioning": {
          const line =
            positioning || profile.coachPositioning?.positioningStatement || "";
          return line
            ? line.length > 72
              ? `${line.slice(0, 72)}…`
              : line
            : "Add your one-liner";
        }
        default:
          return "";
      }
    };

    const doneSteps = PROFILE_STEP_META.filter(
      (_, index) =>
        index < activeProfileStep &&
        profileStatus[PROFILE_SECTIONS[index]!] === "confirmed"
    );
    const upcomingSteps = PROFILE_STEP_META.filter(
      (_, index) => index > activeProfileStep
    );

    return (
      <ProfileReviewShell
        sticky={
          <ProfileSectionStepper
            sections={PROFILE_STEP_META}
            activeIndex={activeProfileStep}
            statuses={profileStatus}
            onSelect={selectStep}
          />
        }
        footer={
          showLockFooter ? (
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <SecondaryButton onClick={() => void generateProfile({ force: true })}>
                  Regenerate profile
                </SecondaryButton>
                <PrimaryButton
                  onClick={() => void lockProfileAndGenerateAvatar()}
                  disabled={!profileAllConfirmed}
                  className="rounded-xl px-5 py-2.5"
                >
                  Lock profile &amp; create Avatar
                </PrimaryButton>
              </div>
              {!profileAllConfirmed ? (
                <p className="text-center text-xs text-slate-400 sm:text-right">
                  Confirm positioning to unlock the Avatar.
                </p>
              ) : null}
            </div>
          ) : undefined
        }
      >
        {error ? <ErrorNote>{error}</ErrorNote> : null}

        {doneSteps.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            {doneSteps.map((step) => {
              const index = PROFILE_SECTIONS.indexOf(step.id);
              return (
                <CollapsedSectionRow
                  key={step.id}
                  index={index}
                  title={step.title}
                  summary={sectionSummary(step.id)}
                  state="done"
                  onClick={() => selectStep(index)}
                />
              );
            })}
          </div>
        ) : null}

        {stepId === "market" ? (
          <SectionConfirmCard
            index={0}
            total={PROFILE_SECTIONS.length}
            hideStepLabel
            title="Target market"
            hint="Confirm who you’re going after — then we’ll research pains in their words."
            status={profileStatus.market}
            confirmLabel="Looks right — research pains"
            onConfirm={() => confirmAndAdvance("market")}
            onStartEdit={() => setProfileStatus((s) => ({ ...s, market: "editing" }))}
            onCancelEdit={() => {
              hydrateProfileEditors(profile);
              setProfileStatus((s) => ({ ...s, market: "pending" }));
            }}
            onSaveEdit={() => confirmAndAdvance("market")}
            editChildren={
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block text-sm">
                  <span className="text-slate-500">Industry</span>
                  <input
                    value={marketIndustry}
                    onChange={(e) => setMarketIndustry(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-slate-200/80 bg-white/70 px-3.5 py-2.5 text-[15px]"
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-slate-500">Geography</span>
                  <input
                    value={marketGeo}
                    onChange={(e) => setMarketGeo(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-slate-200/80 bg-white/70 px-3.5 py-2.5 text-[15px]"
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-slate-500">Team size</span>
                  <input
                    value={marketTeam}
                    onChange={(e) => setMarketTeam(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-slate-200/80 bg-white/70 px-3.5 py-2.5 text-[15px]"
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-slate-500">Revenue</span>
                  <input
                    value={marketRevenue}
                    onChange={(e) => setMarketRevenue(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-slate-200/80 bg-white/70 px-3.5 py-2.5 text-[15px]"
                  />
                </label>
                <label className="block text-sm sm:col-span-2">
                  <span className="text-slate-500">Decision-maker titles (comma-separated)</span>
                  <input
                    value={roleTitlesText}
                    onChange={(e) => setRoleTitlesText(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-slate-200/80 bg-white/70 px-3.5 py-2.5 text-[15px]"
                  />
                </label>
              </div>
            }
          >
            <p className="text-lg font-medium tracking-tight text-slate-900">
              {marketIndustry || profile.targetMarket.industry}
              <span className="font-normal text-slate-400"> · </span>
              {marketGeo || profile.targetMarket.geography}
            </p>
            <p className="mt-1 text-[15px] text-slate-500">
              {(marketTeam || profile.targetMarket.teamSize)} team ·{" "}
              {marketRevenue || profile.targetMarket.revenueRange}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {(roleTitlesText
                ? roleTitlesText.split(",").map((s) => s.trim()).filter(Boolean)
                : profile.decisionMaker.roleTitles
              ).map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center rounded-full border border-sky-200/80 bg-sky-50/80 px-3.5 py-1.5 text-sm font-medium text-sky-900"
                >
                  {t}
                </span>
              ))}
            </div>
          </SectionConfirmCard>
        ) : null}

        {stepId === "pains" ? (
          <SectionConfirmCard
            index={1}
            total={PROFILE_SECTIONS.length}
            hideStepLabel
            title="Pains — in their words"
            hint="Prioritise what you’d write into a message. Drop anything that doesn’t sound like your market."
            status={profileStatus.pains}
            onConfirm={() => confirmAndAdvance("pains")}
            onStartEdit={() => setProfileStatus((s) => ({ ...s, pains: "editing" }))}
            onCancelEdit={() => {
              hydrateProfileEditors(profile);
              setProfileStatus((s) => ({ ...s, pains: "pending" }));
            }}
            onSaveEdit={() => confirmAndAdvance("pains")}
            actionsExtra={
              <button
                type="button"
                onClick={() => void researchPainsForMarket({ force: true })}
                className="inline-flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-sky-700 transition hover:bg-sky-50"
              >
                Research again
              </button>
            }
            editChildren={
              <InteractiveLineList
                key={`pains-edit-${painsListKey}`}
                lines={painLines}
                onChange={setPainLines}
                addPlaceholder="Add a pain in their words…"
              />
            }
          >
            {researchNote ? (
              <p className="mb-3 rounded-xl border border-sky-100 bg-sky-50/70 px-3.5 py-2.5 text-sm text-sky-900">
                {researchNote}
              </p>
            ) : null}
            <InteractiveLineList
              key={`pains-${painsListKey}`}
              lines={painLines}
              onChange={setPainLines}
              addPlaceholder="Add a pain in their words…"
            />
          </SectionConfirmCard>
        ) : null}

        {stepId === "dreams" ? (
          <SectionConfirmCard
            index={2}
            total={PROFILE_SECTIONS.length}
            hideStepLabel
            title="Dreams / desired outcomes"
            hint="Usually the pains inverted — keep what you’d sell toward."
            status={profileStatus.dreams}
            onConfirm={() => confirmAndAdvance("dreams")}
            onStartEdit={() => setProfileStatus((s) => ({ ...s, dreams: "editing" }))}
            onCancelEdit={() => {
              hydrateProfileEditors(profile);
              setProfileStatus((s) => ({ ...s, dreams: "pending" }));
            }}
            onSaveEdit={() => confirmAndAdvance("dreams")}
            editChildren={
              <InteractiveLineList
                lines={dreamLines}
                onChange={setDreamLines}
                addPlaceholder="Add a desired outcome…"
              />
            }
          >
            <InteractiveLineList
              lines={dreamLines}
              onChange={setDreamLines}
              addPlaceholder="Add a desired outcome…"
            />
          </SectionConfirmCard>
        ) : null}

        {stepId === "fit" ? (
          <SectionConfirmCard
            index={3}
            total={PROFILE_SECTIONS.length}
            hideStepLabel
            title="Not a fit"
            hint="Who you won’t work with — soft filters, not red flags on a poster."
            status={profileStatus.fit}
            onConfirm={() => confirmAndAdvance("fit")}
            onStartEdit={() => setProfileStatus((s) => ({ ...s, fit: "editing" }))}
            onCancelEdit={() => {
              hydrateProfileEditors(profile);
              setProfileStatus((s) => ({ ...s, fit: "pending" }));
            }}
            onSaveEdit={() => confirmAndAdvance("fit")}
            editChildren={
              <InteractiveLineList
                lines={notAFitLines}
                onChange={setNotAFitLines}
                variant="soft"
                addPlaceholder="Add a not-a-fit…"
              />
            }
          >
            <InteractiveLineList
              lines={notAFitLines}
              onChange={setNotAFitLines}
              variant="soft"
              addPlaceholder="Add a not-a-fit…"
            />
          </SectionConfirmCard>
        ) : null}

        {stepId === "positioning" ? (
          <SectionConfirmCard
            index={4}
            total={PROFILE_SECTIONS.length}
            hideStepLabel
            accentIndex={4}
            title="Your positioning"
            hint="One clear line — how you’d introduce what you do for this market."
            status={profileStatus.positioning}
            onConfirm={() => confirmAndAdvance("positioning")}
            onStartEdit={() =>
              setProfileStatus((s) => ({ ...s, positioning: "editing" }))
            }
            onCancelEdit={() => {
              hydrateProfileEditors(profile);
              setProfileStatus((s) => ({ ...s, positioning: "pending" }));
            }}
            onSaveEdit={() => confirmAndAdvance("positioning")}
            editChildren={
              <TextArea
                value={positioning}
                onChange={setPositioning}
                rows={3}
                placeholder="I help…"
              />
            }
          >
            <blockquote className="relative overflow-hidden rounded-2xl border border-[#0c5290]/15 bg-gradient-to-br from-[#0c5290]/[0.07] via-white/40 to-[#1ca0c2]/[0.08] px-5 py-5 sm:px-7 sm:py-6">
              <p className="text-lg font-medium leading-snug tracking-tight text-slate-900 sm:text-xl sm:leading-snug">
                {positioning ||
                  profile.coachPositioning?.positioningStatement ||
                  "—"}
              </p>
            </blockquote>
          </SectionConfirmCard>
        ) : null}

        {upcomingSteps.length > 0 ? (
          <div className="flex flex-col gap-1.5 pt-1">
            {upcomingSteps.map((step) => {
              const index = PROFILE_SECTIONS.indexOf(step.id);
              return (
                <CollapsedSectionRow
                  key={step.id}
                  index={index}
                  title={step.title}
                  summary="Up next"
                  state="upcoming"
                />
              );
            })}
          </div>
        ) : null}
      </ProfileReviewShell>
    );
  }

  if (phase === "avatar_review" && generatedAvatar) {
    const persona = generatedAvatar.persona;
    return (
      <div className="flex flex-col gap-5">
        <AiNote>
          {afterSave === "messages"
            ? "This Avatar was built from the Profile you locked. Confirm the human bits that drive messaging — then save to your brain and we’ll draft outreach."
            : hasApprovedAvatar
              ? "This Ideal Client is saved. Outreach and content tools will use it. Reconfirm below if you want to update it."
              : "This Avatar was built from the Profile you locked. Confirm the human bits, then save — this is what outreach and content will use."}
        </AiNote>
        {error ? <ErrorNote>{error}</ErrorNote> : null}

        <SectionConfirmCard
          index={0}
          total={AVATAR_SECTIONS.length}
          title="Who they are"
          hint="Headline, name, role — the person you write to."
          status={avatarStatus.persona}
          onConfirm={() => setAvatarStatus((s) => ({ ...s, persona: "confirmed" }))}
          onStartEdit={() => setAvatarStatus((s) => ({ ...s, persona: "editing" }))}
          onCancelEdit={() => {
            hydrateAvatarEditors(generatedAvatar);
            setAvatarStatus((s) => ({ ...s, persona: "pending" }));
          }}
          onSaveEdit={() => {
            setGeneratedAvatar(applyAvatarEditsToState(generatedAvatar));
            setAvatarStatus((s) => ({ ...s, persona: "confirmed" }));
          }}
          editChildren={
            <div className="flex flex-col gap-2">
              <TextArea value={personaHeadline} onChange={setPersonaHeadline} rows={2} />
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={personaName}
                  onChange={(e) => setPersonaName(e.target.value)}
                  placeholder="Name"
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
                <input
                  value={personaOcc}
                  onChange={(e) => setPersonaOcc(e.target.value)}
                  placeholder="Occupation"
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
            </div>
          }
        >
          <p className="font-medium text-slate-900">{persona.headline}</p>
          <p className="mt-1 text-sm text-slate-600">
            {persona.personaName}
            {persona.demographics?.occupation
              ? ` · ${persona.demographics.occupation}`
              : ""}
          </p>
        </SectionConfirmCard>

        <SectionConfirmCard
          index={1}
          total={AVATAR_SECTIONS.length}
          title="Specific problem (in their words)"
          hint="Quoted, first person — the Tuesday-evening frustration."
          status={avatarStatus.problem}
          onConfirm={() => setAvatarStatus((s) => ({ ...s, problem: "confirmed" }))}
          onStartEdit={() => setAvatarStatus((s) => ({ ...s, problem: "editing" }))}
          onCancelEdit={() => {
            hydrateAvatarEditors(generatedAvatar);
            setAvatarStatus((s) => ({ ...s, problem: "pending" }));
          }}
          onSaveEdit={() => {
            setGeneratedAvatar(applyAvatarEditsToState(generatedAvatar));
            setAvatarStatus((s) => ({ ...s, problem: "confirmed" }));
          }}
          editChildren={
            <TextArea value={specificProblem} onChange={setSpecificProblem} rows={3} />
          }
        >
          <p className="text-sm italic leading-relaxed text-slate-700">
            “{persona.specificProblem?.text}”
          </p>
        </SectionConfirmCard>

        <SectionConfirmCard
          index={2}
          total={AVATAR_SECTIONS.length}
          title="Ready-to-act quote + messaging hooks"
          hint="These feed step 4 outreach directly."
          status={avatarStatus.hooks}
          onConfirm={() => setAvatarStatus((s) => ({ ...s, hooks: "confirmed" }))}
          onStartEdit={() => setAvatarStatus((s) => ({ ...s, hooks: "editing" }))}
          onCancelEdit={() => {
            hydrateAvatarEditors(generatedAvatar);
            setAvatarStatus((s) => ({ ...s, hooks: "pending" }));
          }}
          onSaveEdit={() => {
            setGeneratedAvatar(applyAvatarEditsToState(generatedAvatar));
            setAvatarStatus((s) => ({ ...s, hooks: "confirmed" }));
          }}
          editChildren={
            <div className="flex flex-col gap-3">
              <div>
                <p className="mb-1 text-xs text-slate-400">Quote (ready to act)</p>
                <TextArea value={personaQuote} onChange={setPersonaQuote} rows={2} />
              </div>
              <div>
                <p className="mb-1 text-xs text-slate-400">Messaging hooks (one per line)</p>
                <TextArea value={hooksText} onChange={setHooksText} rows={4} />
              </div>
            </div>
          }
        >
          <p className="text-sm italic text-slate-700">“{persona.quote}”</p>
          <ul className="mt-3 list-disc space-y-1 pl-4 text-sm text-slate-600">
            {(generatedAvatar.messagingHooks ?? generatedAvatar.mainDesires ?? []).map(
              (h, i) => (
                <li key={i}>{h}</li>
              )
            )}
          </ul>
        </SectionConfirmCard>

        <button
          type="button"
          onClick={() => setShowMoreAvatar((v) => !v)}
          className="text-left text-xs font-medium text-sky-700 hover:text-sky-800"
        >
          {showMoreAvatar ? "Hide deeper detail" : "Show more (reality, monologue, triggers)"}
        </button>

        {showMoreAvatar ? (
          <Card title="Deeper detail (optional)">
            {persona.reality?.prose ? (
              <div className="mb-4">
                <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.1em] text-slate-400">
                  Reality
                </p>
                <p className="text-sm italic leading-relaxed text-slate-600">
                  {persona.reality.prose}
                </p>
              </div>
            ) : null}
            {persona.internalMonologue ? (
              <div className="mb-4">
                <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.1em] text-slate-400">
                  Internal monologue
                </p>
                <p className="text-sm text-slate-600">{persona.internalMonologue}</p>
              </div>
            ) : null}
            {generatedAvatar.triggers ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.1em] text-slate-400">
                    Fears
                  </p>
                  <Bullets points={generatedAvatar.triggers.fears} />
                </div>
                <div>
                  <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.1em] text-slate-400">
                    Dreams
                  </p>
                  <Bullets points={generatedAvatar.triggers.dreams} />
                </div>
              </div>
            ) : null}
          </Card>
        ) : null}

        <Card
          title="Save to brain"
          description="Pick which slices feed message generation and future AI."
        >
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {CAMPAIGN_BRAIN_KEYS.map((key) => (
              <label
                key={key}
                className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-slate-200 px-3 py-2.5 hover:bg-slate-50"
              >
                <input
                  type="checkbox"
                  checked={selectedKeys.has(key)}
                  onChange={() => toggleKey(key)}
                  className="mt-0.5 rounded border-slate-300"
                />
                <span>
                  <span className="block text-sm font-medium text-slate-800">
                    {BRAIN_KEY_LABEL[key]}
                  </span>
                  <span className="block text-xs text-slate-500">
                    {BRAIN_KEY_HINT[key]}
                  </span>
                </span>
              </label>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <SecondaryButton
              onClick={() => {
                setPhase("profile_review");
                setProfileStatus(initialStatuses(PROFILE_SECTIONS, true));
              }}
            >
              Back to Profile
            </SecondaryButton>
            <PrimaryButton
              onClick={() => void handleFinalConfirm()}
              disabled={!avatarAllConfirmed}
            >
              {afterSave === "messages"
                ? "Confirm & continue to messages"
                : "Confirm and save"}
            </PrimaryButton>
          </div>
          {!avatarAllConfirmed ? (
            <p className="mt-2 text-xs text-slate-400">
              Confirm all three Avatar sections to continue.
            </p>
          ) : null}
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {error ? <ErrorNote>{error}</ErrorNote> : null}
      <PrimaryButton onClick={() => void generateProfile({ force: true })} disabled={!icp}>
        Generate Ideal Client Profile
      </PrimaryButton>
    </div>
  );
}
