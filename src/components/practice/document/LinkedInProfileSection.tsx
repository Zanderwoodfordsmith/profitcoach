"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Copy, Loader2 } from "lucide-react";

import { ProfileOptimizerCanvas, SECTION_META } from "@/components/linkedinProfileOptimizer/ProfileOptimizerCanvas";
import {
  getOptimizer,
  importLinkedInProfile,
  rewriteOptimizerSection,
  saveOptimizerDraft,
} from "@/components/linkedinProfileOptimizer/api";
import type { LinkedInProfileSnapshot } from "@/lib/apify/linkedinProfileTypes";
import { copyTextToClipboard } from "@/lib/copyTextToClipboard";
import {
  emptyDraft,
  experienceDraftAt,
  hasFeaturedPlan,
  parseExperienceVariant,
  sectionStatus,
  textForSection,
  upsertExperienceDraft,
} from "@/lib/linkedinProfileOptimizer/draft";
import {
  REWRITE_COOLDOWN_MS,
  type LinkedInImportProfile,
  type PartStatus,
  type ProfileOptimizerDraft,
  type ProfileOptimizerVariant,
  type ProfileSectionId,
} from "@/lib/linkedinProfileOptimizer/types";
import { fieldValue } from "@/lib/practiceKnowledge/blueprint";
import type { BlueprintBlock } from "@/lib/practiceKnowledge/types";
import { GOOGLE_FONTS_HREF } from "@/lib/printPack/brand.js";
import {
  MAX_BANNER_OPTIONS,
  defaultBannerOption,
  defaultBannerOptions,
  nextBannerDesign,
  type BannerField,
  type BannerOption,
} from "@/lib/linkedinBanner/designs";
import { BannerStage, BannerStrip } from "@/components/linkedinBanner/BannerPicker";

import { usePractice } from "../PracticeProvider";
import { StatusSwitch } from "./StatusMenu";
import { AvaHalo } from "@/components/ava/AvaHalo";
import { useShowAdminPreviewTabs } from "@/components/layout/CoachToolsHubTabs";

const SAVE_DEBOUNCE_MS = 700;
/** The order "Write every part" goes in: the top of the profile first. */
const WRITE_ORDER: ProfileSectionId[] = ["headline", "about", "featured", "experience"];

/** An empty profile, so a coach sees the shape before they import theirs. */
const EMPTY_SNAPSHOT: LinkedInProfileSnapshot = {
  linkedinUrl: null,
  publicIdentifier: null,
  firstName: null,
  lastName: null,
  fullName: "Your name",
  headline: "Your headline: who you help, and the result",
  about: "Your About section, written to the owner you want to work with.",
  photoUrl: null,
  bannerUrl: null,
  location: "Your town",
  connectionsCount: null,
  followerCount: null,
  experiences: [],
  education: [],
  skills: [],
  featured: [],
};

function hasDraft(section: ProfileSectionId, draft: ProfileOptimizerDraft): boolean {
  if (section === "headline") return Boolean(draft.headline?.trim());
  if (section === "about") return Boolean(draft.about?.trim());
  if (section === "banner") return Boolean(draft.banners?.length || draft.bannerTemplate || draft.bannerCopy?.trim());
  if (section === "featured") return hasFeaturedPlan(draft) || Boolean(draft.featuredNotes?.trim());
  const row = experienceDraftAt(draft, 0);
  return Boolean(row?.title?.trim() || row?.description?.trim());
}

/** The first message under a heading in the old written profile, e.g. "Headline option 1". */
function messageUnder(blocks: BlueprintBlock[], heading: string): string {
  const at = blocks.findIndex((b) => b.type === "heading" && b.text.trim().toLowerCase() === heading);
  if (at < 0) return "";
  const next = blocks.slice(at + 1).find((b) => b.type === "message" || b.type === "heading");
  return next?.type === "message" ? next.body.trim() : "";
}

/**
 * The LinkedIn profile, inside the Blueprint. Today shows what owners see now;
 * New is the working copy. Click any part to edit it. Rewrites use the coach's
 * Blueprint (voice, who they help, offer, proof).
 */
export function LinkedInProfileSection() {
  const { coachId, payload, knowledge, sample } = usePractice();
  // Writing from the Blueprint is BCA's job: coaches (and "View as coach") edit by hand.
  const canWrite = useShowAdminPreviewTabs(Boolean(coachId));
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<LinkedInImportProfile | null>(null);
  const [draft, setDraft] = useState<ProfileOptimizerDraft>({});
  const [urlInput, setUrlInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [mode, setMode] = useState<"new" | "today">("new");
  const [active, setActive] = useState<ProfileSectionId | null>(null);
  const [activeRole, setActiveRole] = useState(0);
  /** The part (and role) being written on its own, outside "Write every part". */
  const [writingOne, setWritingOne] = useState<string | null>(null);
  const [writingAll, setWritingAll] = useState<ProfileSectionId | null>(null);
  const [copied, setCopied] = useState<ProfileSectionId | null>(null);
  const saveTimer = useRef<number | null>(null);
  const draftRef = useRef(draft);
  const lastRewriteAt = useRef(0);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  const persist = useCallback(
    (next: ProfileOptimizerDraft) => {
      if (sample) return;
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(() => {
        saveTimer.current = null;
        void saveOptimizerDraft(next, coachId).then((result) => {
          if (!result.ok) setError(result.error ?? "Could not save your profile draft.");
        });
      }, SAVE_DEBOUNCE_MS);
    },
    [coachId, sample]
  );

  const updateDraft = useCallback(
    (next: ProfileOptimizerDraft) => {
      draftRef.current = next;
      setDraft(next);
      persist(next);
    },
    [persist]
  );

  const oldWritten = knowledge?.built_sections["linkedin:rewrite"]?.blocks;
  const blueprintUrl = payload ? String(fieldValue(payload, "identity.linkedin_url")?.value ?? "") : "";

  useEffect(() => {
    if (sample) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void getOptimizer(coachId).then((result) => {
      if (cancelled) return;
      if (!result.ok || !result.data) {
        setError(result.error ?? "Could not load your LinkedIn profile.");
        setLoading(false);
        return;
      }
      setProfile(result.data.profile);
      setUrlInput(result.data.savedLinkedinUrl ?? result.data.profile?.linkedinUrl ?? "");
      let next = result.data.draft ?? {};
      // A profile BCA already wrote in the Blueprint fills an empty draft once, so nothing is lost.
      if (result.data.profile && emptyDraft(next) && oldWritten?.length) {
        const seeded: ProfileOptimizerDraft = {
          headline: messageUnder(oldWritten, "headline") || null,
          about: messageUnder(oldWritten, "about") || null,
        };
        if (!emptyDraft(seeded)) {
          next = { ...next, ...seeded };
          void saveOptimizerDraft(next, coachId);
        }
      }
      draftRef.current = next;
      setDraft(next);
      setLoading(false);
    });
    return () => {
      cancelled = true;
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
    // oldWritten is read once, when the profile first loads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coachId, sample]);

  // Ava can save a new profile from her chat. When the Blueprint reloads after that, show it,
  // unless an edit here is still waiting to save.
  const seenKnowledge = useRef(knowledge);
  useEffect(() => {
    if (sample || seenKnowledge.current === knowledge) return;
    const before = seenKnowledge.current;
    seenKnowledge.current = knowledge;
    // The first load reads the profile itself.
    if (loading || !before) return;
    let cancelled = false;
    void getOptimizer(coachId).then((result) => {
      if (cancelled || saveTimer.current || !result.ok || !result.data?.profile) return;
      setProfile(result.data.profile);
      draftRef.current = result.data.draft ?? {};
      setDraft(draftRef.current);
    });
    return () => {
      cancelled = true;
    };
  }, [knowledge, coachId, sample, loading]);

  // The banner options: the coach's own once they change anything, else the first set.
  const bannerOptions = draft.banners?.length ? draft.banners : defaultBannerOptions();
  const bannerAt = Math.min(draft.bannerChosen ?? 0, bannerOptions.length - 1);
  const discreet = payload ? fieldValue(payload, "identity.linkedin_visibility")?.value === "discreet" : false;
  const setBanners = (banners: BannerOption[], bannerChosen: number) =>
    updateDraft({ ...draftRef.current, banners, bannerChosen });
  const currentBanners = () => (draftRef.current.banners?.length ? draftRef.current.banners : defaultBannerOptions());
  function stepBanner(delta: number) {
    const n = bannerOptions.length;
    setBanners(currentBanners(), (bannerAt + delta + n) % n);
  }
  function setBannerWords(field: BannerField, value: string) {
    const options = currentBanners().map((o, i) => (i === bannerAt ? { ...o, words: { ...o.words, [field]: value } } : o));
    setBanners(options, bannerAt);
  }
  function addBanner() {
    const options = currentBanners();
    if (options.length >= MAX_BANNER_OPTIONS) return;
    const next = [...options, defaultBannerOption(nextBannerDesign(options, options[bannerAt]?.design ?? ""))];
    setBanners(next, next.length - 1);
  }
  function removeBanner(index: number) {
    const options = currentBanners().filter((_, i) => i !== index);
    setBanners(options, Math.min(bannerAt > index ? bannerAt - 1 : bannerAt, options.length - 1));
  }

  function applyVariant(variant: ProfileOptimizerVariant, section: ProfileSectionId, role: number) {
    const d = draftRef.current;
    if (section === "headline") return updateDraft({ ...d, headline: variant.text });
    if (section === "about") return updateDraft({ ...d, about: variant.text });
    if (section === "featured") return updateDraft({ ...d, featuredNotes: variant.text });
    if (section === "experience") {
      const parsed = parseExperienceVariant(variant.text);
      // A past role keeps its own title; only the current role's title is rewritten.
      const title = role === 0 ? parsed.title : experienceDraftAt(d, role)?.title ?? profile?.snapshot.experiences[role]?.title ?? parsed.title;
      updateDraft(upsertExperienceDraft(d, { index: role, ...parsed, title }));
    }
  }

  /** One rewrite from the Blueprint, waiting out the server's short cooldown between calls. */
  /** keepHeadline: add new headline options without changing the one in use. */
  async function rewrite(section: ProfileSectionId, role = 0, keepHeadline = false): Promise<boolean> {
    const wait = lastRewriteAt.current + REWRITE_COOLDOWN_MS + 300 - Date.now();
    if (wait > 0) await new Promise((r) => window.setTimeout(r, wait));
    lastRewriteAt.current = Date.now();
    const result = await rewriteOptimizerSection({ section, experienceIndex: role }, coachId);
    const variants = result.data?.variants ?? [];
    if (!result.ok || !variants.length) {
      setError(result.error ?? "Could not write that part.");
      return false;
    }
    const recommended = variants.find((v) => v.recommended) ?? variants[0];
    if (section === "headline") {
      // Keep every option to pick from, the recommended one first.
      const options = [recommended, ...variants.filter((v) => v !== recommended)].map((v) => v!.text);
      const d = draftRef.current;
      updateDraft({ ...d, headline: keepHeadline && d.headline?.trim() ? d.headline : recommended!.text, headlineOptions: options });
      return true;
    }
    if (recommended) applyVariant(recommended, section, role);
    return true;
  }

  /** One part on its own: the headline options, or one role. */
  async function writeOne(section: ProfileSectionId, role = 0) {
    setError(null);
    setWritingOne(`${section}:${role}`);
    await rewrite(section, role, true);
    setWritingOne(null);
  }

  async function writeEverything() {
    setError(null);
    setMode("new");
    for (const section of WRITE_ORDER) {
      setWritingAll(section);
      if (!(await rewrite(section))) break;
    }
    setWritingAll(null);
  }

  async function copyPart(section: ProfileSectionId) {
    if (!profile) return;
    const ok = await copyTextToClipboard(textForSection(section, profile.snapshot, draftRef.current, section === "experience" ? activeRole : 0));
    if (!ok) {
      setError("Could not copy. Select the text and copy it yourself.");
      return;
    }
    setCopied(section);
    window.setTimeout(() => setCopied(null), 1600);
    updateDraft({ ...draftRef.current, copiedAt: { ...draftRef.current.copiedAt, [section]: new Date().toISOString() } });
  }

  async function handleImport() {
    setError(null);
    setImporting(true);
    const result = await importLinkedInProfile(urlInput || blueprintUrl, coachId);
    setImporting(false);
    if (!result.ok || !result.data?.profile) {
      setError(result.error ?? "Could not import your LinkedIn profile.");
      return;
    }
    setProfile(result.data.profile);
    setUrlInput(result.data.profile.linkedinUrl);
  }

  /** The coach's own choice wins. Otherwise: To do until written, Review until copied, Done once copied. */
  function partStatus(section: ProfileSectionId): PartStatus {
    const chosen = draft.partStatus?.[section];
    if (chosen) return chosen;
    if (!profile) return "todo";
    const live = sectionStatus(section, profile.snapshot, draft);
    if (live === "draft") return draft.copiedAt?.[section] ? "done" : "review";
    return hasDraft(section, draft) ? "done" : "todo";
  }

  function partControls(section: ProfileSectionId) {
    const label = SECTION_META.find((s) => s.id === section)?.label ?? section;
    const canCopy = section !== "banner" && hasDraft(section, draft);
    return (
      <span className="inline-flex items-center gap-1.5">
        {canCopy ? (
          <button
            type="button"
            onClick={() => void copyPart(section)}
            title={`Copy the new ${label} to paste into LinkedIn`}
            className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-[#0a66c2] ring-1 ring-inset ring-[#c8d9ec] hover:bg-[#eef5fc]"
          >
            {copied === section ? <Check className="h-3 w-3" aria-hidden /> : <Copy className="h-3 w-3" aria-hidden />}
            {copied === section ? "Copied" : "Copy"}
          </button>
        ) : null}
        <StatusSwitch
          size="sm"
          label={label}
          status={partStatus(section)}
          onChange={(status) =>
            updateDraft({ ...draftRef.current, partStatus: { ...draftRef.current.partStatus, [section]: status } })
          }
        />
      </span>
    );
  }

  if (loading) {
    return (
      <p className="inline-flex items-center gap-2 text-sm text-[var(--bp-muted)]">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading your LinkedIn…
      </p>
    );
  }

  if (sample) {
    return <p className="text-sm text-[var(--bp-muted)]">The coach&apos;s LinkedIn shows here once they import it.</p>;
  }

  if (!profile) {
    return (
      <div className="space-y-4">
        <div className="space-y-3 rounded-xl bg-[var(--bp-tint)] px-4 py-4">
          <p className="text-[0.9375rem] leading-6 text-[var(--bp-body)]">
            Import your LinkedIn to see it here as owners do, then make it better from your Blueprint.
          </p>
          <div className="flex flex-col gap-2 @xl:flex-row">
            <input
              value={urlInput || blueprintUrl}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://www.linkedin.com/in/you"
              aria-label="LinkedIn profile link"
              className="bp-input w-full rounded-xl border border-[#e3e9f0] bg-white px-3.5 py-2 text-[0.9844rem] text-[var(--bp-ink)] outline-none focus:border-[#bfdcf2]"
            />
            <button
              type="button"
              disabled={importing}
              onClick={() => void handleImport()}
              className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full bg-[var(--bp-navy)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--bp-blue)] disabled:opacity-50"
            >
              {importing ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              {importing ? "Importing…" : "Import my LinkedIn"}
            </button>
          </div>
          {error ? <p className="text-sm text-[#9b1c1c]">{error}</p> : null}
        </div>
        <div aria-hidden className="pointer-events-none -mx-5 select-none overflow-hidden bg-[#f4f2ee] px-2 py-2 opacity-60 @xl:py-3 @2xl:-mx-6">
          <ProfileOptimizerCanvas
            snapshot={EMPTY_SNAPSHOT}
            draft={{}}
            activeSection={null}
            onSelect={() => {}}
            onHeadline={() => {}}
            onAbout={() => {}}
            onBannerCopy={() => {}}
            onFeaturedNotes={() => {}}
            onExperience={() => {}}
            statusFor={() => null}
          />
        </div>
      </div>
    );
  }

  const today = mode === "today";

  return (
    <div className="space-y-3">
      <link rel="stylesheet" href={GOOGLE_FONTS_HREF} precedence="default" />
      <div className="bp-no-print flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Which version" className="inline-flex rounded-full bg-[#eef2f6] p-0.5">
          {(["today", "new"] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => setMode(m)}
              className={`rounded-full px-3.5 py-1 text-sm ${
                mode === m
                  ? "bg-white font-semibold text-[var(--bp-ink)] shadow-[0_1px_2px_rgba(5,30,54,0.15)]"
                  : "font-medium text-[var(--bp-muted)] hover:text-[var(--bp-ink)]"
              }`}
            >
              {m === "today" ? "Today" : "New"}
            </button>
          ))}
        </div>
        {canWrite ? (
          <button
            type="button"
            disabled={Boolean(writingAll)}
            onClick={() => void writeEverything()}
            className="inline-flex items-center gap-1.5 rounded-full bg-[var(--bp-navy)] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[var(--bp-blue)] disabled:opacity-50"
          >
            <AvaHalo size={16} dark state={writingAll ? "thinking" : "idle"} />
            {writingAll
              ? `Writing ${SECTION_META.find((s) => s.id === writingAll)?.label ?? ""}…`
              : "Write every part from my Blueprint"}
          </button>
        ) : null}
      </div>

      {error ? <p className="text-sm text-[#9b1c1c]">{error}</p> : null}

      <div className="-mx-5 overflow-hidden bg-[#f4f2ee] px-2 py-2 @xl:py-3 @2xl:-mx-6">
        <ProfileOptimizerCanvas
          snapshot={profile.snapshot}
          draft={today ? {} : draft}
          activeSection={today ? null : active}
          onSelect={today ? () => {} : setActive}
          onHeadline={(headline) => updateDraft({ ...draftRef.current, headline })}
          onAbout={(about) => updateDraft({ ...draftRef.current, about })}
          onBannerCopy={(bannerCopy) => updateDraft({ ...draftRef.current, bannerCopy })}
          onFeaturedNotes={(featuredNotes) => updateDraft({ ...draftRef.current, featuredNotes })}
          onExperience={(patch, index) => updateDraft(upsertExperienceDraft(draftRef.current, { index, ...patch }))}
          activeExperience={activeRole}
          onSelectExperience={today ? undefined : setActiveRole}
          roleTools={
            canWrite
              ? (index) => (
                  <WriteButton
                    busy={writingOne === `experience:${index}`}
                    disabled={Boolean(writingAll || writingOne)}
                    label="Write this role from my Blueprint"
                    onClick={() => void writeOne("experience", index)}
                  />
                )
              : undefined
          }
          statusFor={today ? () => null : partControls}
          bannerNode={
            today ? null : (
              <BannerStage
                key={bannerAt}
                option={bannerOptions[bannerAt]}
                discreet={discreet}
                active={active === "banner"}
                count={bannerOptions.length}
                onStep={stepBanner}
                onWords={setBannerWords}
              />
            )
          }
          bannerCopyEditable={false}
          afterTop={
            !today && active === "banner" ? (
              <BannerStrip
                options={bannerOptions}
                chosen={bannerAt}
                discreet={discreet}
                onChoose={(i) => setBanners(currentBanners(), i)}
                onAdd={addBanner}
                onRemove={removeBanner}
              />
            ) : !today && active === "headline" && (canWrite || draft.headlineOptions?.length) ? (
              <HeadlineChooser
                options={draft.headlineOptions ?? []}
                chosen={draft.headline ?? ""}
                busy={writingOne === "headline:0" || writingAll === "headline"}
                disabled={Boolean(writingAll || writingOne)}
                onChoose={(headline) => updateDraft({ ...draftRef.current, headline })}
                onWrite={canWrite ? () => void writeOne("headline") : undefined}
              />
            ) : null
          }
          featuredPlan={today ? undefined : draft.featuredPlan}
          onFeaturedPlan={today ? undefined : (featuredPlan) => updateDraft({ ...draftRef.current, featuredPlan })}
        />
      </div>

      <p className="bp-no-print px-0.5 text-xs text-[var(--bp-muted)]">
        {today
          ? "This is your LinkedIn as owners see it today."
          : "Click any part to edit it. Copy each part into LinkedIn yourself: we never post to your profile."}
        {profile.linkedinUrl ? (
          <>
            {" "}
            <a href={profile.linkedinUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-[var(--bp-blue)] hover:underline">
              Open LinkedIn
            </a>
          </>
        ) : null}
      </p>
    </div>
  );
}

/** The headline options the writer gave, to pick from. */
function HeadlineChooser({
  options,
  chosen,
  busy,
  disabled,
  onChoose,
  onWrite,
}: {
  options: string[];
  chosen: string;
  busy: boolean;
  disabled: boolean;
  onChoose: (headline: string) => void;
  /** Left out for coaches: BCA writes the options. */
  onWrite?: () => void;
}) {
  return (
    <div className="bp-no-print space-y-3 rounded-xl border border-[#e3e9f0] bg-white px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-[var(--bp-ink)]">{options.length ? "Pick a headline" : "Headline options"}</p>
        {onWrite ? (
          <WriteButton busy={busy} disabled={disabled} label={options.length ? "Write new options" : "Write options from my Blueprint"} onClick={onWrite} />
        ) : null}
      </div>
      {options.length ? (
        <ul className="space-y-2">
          {options.map((option, i) => {
            const selected = option.trim() === chosen.trim();
            return (
              <li key={`${i}-${option.slice(0, 20)}`}>
                <button
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onChoose(option)}
                  className={`flex w-full items-start gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm leading-6 text-[var(--bp-ink)] ring-2 transition ${
                    selected ? "bg-[#f4f9fd] ring-[var(--bp-sky)]" : "bg-[#f8fafc] ring-transparent hover:ring-[#c8d9ec]"
                  }`}
                >
                  <span
                    className={`mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                      selected ? "border-[var(--bp-sky)] bg-[var(--bp-sky)] text-white" : "border-[#c8d9ec] bg-white"
                    }`}
                    aria-hidden
                  >
                    {selected ? <Check className="h-3 w-3" /> : null}
                  </span>
                  <span className="min-w-0">
                    {option}
                    {i === 0 ? <span className="ml-2 text-xs font-semibold text-[var(--bp-muted)]">Recommended</span> : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-[var(--bp-muted)]">Ava writes a few from your Blueprint. Pick one, then change any words in the headline above.</p>
      )}
    </div>
  );
}

function WriteButton({ busy, disabled, label, onClick }: { busy: boolean; disabled: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-full bg-[var(--bp-navy)] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[var(--bp-blue)] disabled:opacity-50"
    >
      <AvaHalo size={16} dark state={busy ? "thinking" : "idle"} />
      {busy ? "Writing…" : label}
    </button>
  );
}
