"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Copy, Download, Loader2 } from "lucide-react";

import { ProfileOptimizerCanvas, SECTION_META } from "@/components/linkedinProfileOptimizer/ProfileOptimizerCanvas";
import {
  getOptimizer,
  importLinkedInProfile,
  rewriteOptimizerSection,
  saveOptimizerDraft,
} from "@/components/linkedinProfileOptimizer/api";
import type { LinkedInProfileSnapshot } from "@/lib/apify/linkedinProfileTypes";
import { getCoachAuthHeaders } from "@/lib/coachAuthHeaders";
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
  BANNER_TEMPLATES,
  REWRITE_COOLDOWN_MS,
  type BannerTemplateId,
  type LinkedInImportProfile,
  type PartStatus,
  type ProfileOptimizerDraft,
  type ProfileOptimizerVariant,
  type ProfileSectionId,
} from "@/lib/linkedinProfileOptimizer/types";
import { fieldValue } from "@/lib/practiceKnowledge/blueprint";
import type { BlueprintBlock } from "@/lib/practiceKnowledge/types";
import { GOOGLE_FONTS_HREF } from "@/lib/printPack/brand.js";
import { downloadPng, imageUrlToDataUri, svgForInline } from "@/lib/printPack/browserExport";
import { PERSONAL, PLACEHOLDER_COACH } from "@/lib/printPack/catalog.js";
import { makeCoach } from "@/lib/printPack/coach.js";

import { usePractice } from "../PracticeProvider";
import { StatusSwitch } from "./StatusMenu";
import { AvaHalo } from "@/components/ava/AvaHalo";

const SAVE_DEBOUNCE_MS = 700;
/** The order "Write every part" goes in: the top of the profile first. */
const WRITE_ORDER: ProfileSectionId[] = ["headline", "about", "featured", "experience"];

type BannerItem = { id: string; title: string; png: number; render: (ctx: { coach?: unknown }) => string };
const BANNERS = (PERSONAL as BannerItem[]).filter((item) =>
  (BANNER_TEMPLATES as readonly string[]).includes(item.id)
);

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
  if (section === "banner") return Boolean(draft.bannerTemplate || draft.bannerCopy?.trim());
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

/** The coach's details for the Toolkit banners: name, business, photo and QR link. */
function useBannerCoach(coachId: string | null, enabled: boolean) {
  const [coach, setCoach] = useState<unknown>(PLACEHOLDER_COACH);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void (async () => {
      try {
        const headers = await getCoachAuthHeaders(coachId);
        if (!headers) return;
        const res = await fetch("/api/coach/toolkit", { headers });
        if (!res.ok) return;
        const body = (await res.json()) as { name: string | null; business: string | null; avatar_url: string | null; coach_slug: string | null };
        const avatarDataUri = await imageUrlToDataUri(body.avatar_url);
        const base = { name: body.name ?? PLACEHOLDER_COACH.name, business: body.business ?? "", avatarDataUri };
        const next = body.coach_slug ? await makeCoach({ ...base, slug: body.coach_slug }, { link: "score" }) : { ...PLACEHOLDER_COACH, ...base };
        if (!cancelled) setCoach(next);
      } catch {
        // Placeholders stay; the banners still show their layout.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [coachId, enabled]);
  return coach;
}

/**
 * The LinkedIn profile, inside the Blueprint. Today shows what owners see now;
 * New is the working copy. Click any part to edit it. Rewrites use the coach's
 * Blueprint (voice, who they help, offer, proof).
 */
export function LinkedInProfileSection() {
  const { coachId, payload, knowledge, sample } = usePractice();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<LinkedInImportProfile | null>(null);
  const [draft, setDraft] = useState<ProfileOptimizerDraft>({});
  const [urlInput, setUrlInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [mode, setMode] = useState<"new" | "today">("new");
  const [active, setActive] = useState<ProfileSectionId | null>(null);
  const [writingAll, setWritingAll] = useState<ProfileSectionId | null>(null);
  const [copied, setCopied] = useState<ProfileSectionId | null>(null);
  const [downloading, setDownloading] = useState(false);
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

  const bannerCoach = useBannerCoach(coachId, Boolean(profile));
  const bannerSvgs = useMemo(() => {
    const out: Partial<Record<BannerTemplateId, string>> = {};
    for (const item of BANNERS) out[item.id as BannerTemplateId] = item.render({ coach: bannerCoach });
    return out;
  }, [bannerCoach]);
  const chosenBanner = draft.bannerTemplate ? bannerSvgs[draft.bannerTemplate] : undefined;

  function applyVariant(variant: ProfileOptimizerVariant, section: ProfileSectionId) {
    const d = draftRef.current;
    if (section === "headline") return updateDraft({ ...d, headline: variant.text });
    if (section === "about") return updateDraft({ ...d, about: variant.text });
    if (section === "featured") return updateDraft({ ...d, featuredNotes: variant.text });
    if (section === "experience") updateDraft(upsertExperienceDraft(d, { index: 0, ...parseExperienceVariant(variant.text) }));
  }

  /** One rewrite from the Blueprint, waiting out the server's short cooldown between calls. */
  async function rewrite(section: ProfileSectionId): Promise<boolean> {
    const wait = lastRewriteAt.current + REWRITE_COOLDOWN_MS + 300 - Date.now();
    if (wait > 0) await new Promise((r) => window.setTimeout(r, wait));
    lastRewriteAt.current = Date.now();
    const result = await rewriteOptimizerSection({ section, experienceIndex: 0 }, coachId);
    const variants = result.data?.variants ?? [];
    if (!result.ok || !variants.length) {
      setError(result.error ?? "Could not write that part.");
      return false;
    }
    const recommended = variants.find((v) => v.recommended) ?? variants[0];
    if (recommended) applyVariant(recommended, section);
    return true;
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
    const ok = await copyTextToClipboard(textForSection(section, profile.snapshot, draftRef.current));
    if (!ok) {
      setError("Could not copy. Select the text and copy it yourself.");
      return;
    }
    setCopied(section);
    window.setTimeout(() => setCopied(null), 1600);
    updateDraft({ ...draftRef.current, copiedAt: { ...draftRef.current.copiedAt, [section]: new Date().toISOString() } });
  }

  async function downloadBanner() {
    const id = draftRef.current.bannerTemplate;
    const item = BANNERS.find((b) => b.id === id);
    const svg = id ? bannerSvgs[id] : undefined;
    if (!item || !svg) return;
    setDownloading(true);
    try {
      await downloadPng(svg, item.png, `linkedin-banner-${item.id.replace(/^p-li-/, "")}.png`);
    } catch {
      setError("Could not make the banner image. Try again.");
    }
    setDownloading(false);
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
        <div aria-hidden className="pointer-events-none select-none overflow-hidden rounded-xl bg-[#f4f2ee] p-2 opacity-60 @xl:p-3">
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
      </div>

      {error ? <p className="text-sm text-[#9b1c1c]">{error}</p> : null}

      <div className="overflow-hidden rounded-xl bg-[#f4f2ee] p-2 @xl:p-3">
        <ProfileOptimizerCanvas
          snapshot={profile.snapshot}
          draft={today ? {} : draft}
          activeSection={today ? null : active}
          onSelect={today ? () => {} : setActive}
          onHeadline={(headline) => updateDraft({ ...draftRef.current, headline })}
          onAbout={(about) => updateDraft({ ...draftRef.current, about })}
          onBannerCopy={(bannerCopy) => updateDraft({ ...draftRef.current, bannerCopy })}
          onFeaturedNotes={(featuredNotes) => updateDraft({ ...draftRef.current, featuredNotes })}
          onExperience={(patch) => updateDraft(upsertExperienceDraft(draftRef.current, { index: 0, ...patch }))}
          statusFor={today ? () => null : partControls}
          bannerNode={!today && chosenBanner ? <div dangerouslySetInnerHTML={{ __html: svgForInline(chosenBanner) }} /> : null}
          bannerCopyEditable={false}
          afterTop={
            !today && active === "banner" ? (
              <BannerChooser
                svgs={bannerSvgs}
                chosen={draft.bannerTemplate ?? null}
                downloading={downloading}
                onChoose={(id) => updateDraft({ ...draftRef.current, bannerTemplate: id })}
                onDownload={() => void downloadBanner()}
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

/** The Toolkit's LinkedIn banners, already personalised, to pick from and download. */
function BannerChooser({
  svgs,
  chosen,
  downloading,
  onChoose,
  onDownload,
}: {
  svgs: Partial<Record<BannerTemplateId, string>>;
  chosen: BannerTemplateId | null;
  downloading: boolean;
  onChoose: (id: BannerTemplateId | null) => void;
  onDownload: () => void;
}) {
  return (
    <div className="bp-no-print space-y-3 rounded-xl border border-[#e3e9f0] bg-white px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-[var(--bp-ink)]">Choose a banner</p>
        {chosen ? (
          <button
            type="button"
            disabled={downloading}
            onClick={onDownload}
            className="inline-flex items-center gap-1.5 rounded-full bg-[var(--bp-navy)] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[var(--bp-blue)] disabled:opacity-50"
          >
            {downloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Download className="h-3.5 w-3.5" aria-hidden />}
            Download for LinkedIn
          </button>
        ) : null}
      </div>
      <p className="text-sm text-[var(--bp-muted)]">
        Your name, photo and scorecard QR are already on them. Pick one, download it, and upload it as your LinkedIn background photo.
      </p>
      <div className="grid gap-2.5 @xl:grid-cols-2">
        {BANNERS.map((item) => {
          const id = item.id as BannerTemplateId;
          const selected = chosen === id;
          return (
            <button
              key={id}
              type="button"
              aria-pressed={selected}
              onClick={() => onChoose(selected ? null : id)}
              className={`overflow-hidden rounded-lg text-left ring-2 transition ${
                selected ? "ring-[var(--bp-sky)]" : "ring-transparent hover:ring-[#c8d9ec]"
              }`}
            >
              <div
                className="aspect-[1584/396] w-full [&>svg]:h-full [&>svg]:w-full"
                dangerouslySetInnerHTML={{ __html: svgForInline(svgs[id] ?? "") }}
              />
              <p className="flex items-center gap-1.5 bg-[#f4f7fa] px-2.5 py-1.5 text-xs font-medium text-[var(--bp-ink)]">
                {selected ? <Check className="h-3.5 w-3.5 text-[var(--bp-sky)]" aria-hidden /> : null}
                {item.title.replace(/^LinkedIn banner - /, "")}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
