"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { StickyPageHeader } from "@/components/layout";
import { CoachToolsHubTabs } from "@/components/layout/CoachToolsHubTabs";
import {
  ErrorNote,
  PrimaryButton,
  TextField,
} from "@/components/firstCampaign/firstCampaignUi";
import {
  ProfileOptimizerCanvas,
  ProfileProgressStrip,
  SECTION_META,
} from "@/components/linkedinProfileOptimizer/ProfileOptimizerCanvas";
import {
  RewriteCoachPanel,
  type RewriteChatTurn,
} from "@/components/linkedinProfileOptimizer/RewriteCoachPanel";
import { RewritePromptAdminControl } from "@/components/linkedinProfileOptimizer/RewritePromptAdminControl";
import {
  getOptimizer,
  importLinkedInProfile,
  rewriteOptimizerSection,
  saveOptimizerDraft,
} from "@/components/linkedinProfileOptimizer/api";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { copyTextToClipboard } from "@/lib/copyTextToClipboard";
import {
  experienceDraftAt,
  parseExperienceVariant,
  textForSection,
  upsertExperienceDraft,
} from "@/lib/linkedinProfileOptimizer/draft";
import type {
  LinkedInImportProfile,
  ProfileOptimizerDraft,
  ProfileOptimizerVariant,
  ProfileSectionId,
} from "@/lib/linkedinProfileOptimizer/types";

const SAVE_DEBOUNCE_MS = 700;

function sectionHasDraft(
  section: ProfileSectionId | null,
  draft: ProfileOptimizerDraft
): boolean {
  if (!section) return false;
  if (section === "headline") return Boolean(draft.headline?.trim());
  if (section === "about") return Boolean(draft.about?.trim());
  if (section === "banner") return Boolean(draft.bannerCopy?.trim());
  if (section === "featured") return Boolean(draft.featuredNotes?.trim());
  const row = experienceDraftAt(draft, 0);
  return Boolean(row?.title?.trim() || row?.description?.trim());
}

export function ProfileOptimizerPage() {
  const pathname = usePathname();
  const prefix = pathname.startsWith("/admin") ? "/admin" : "/coach";
  const { impersonatingCoachId } = useImpersonation();
  const impersonate = impersonatingCoachId;

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<LinkedInImportProfile | null>(null);
  const [draft, setDraft] = useState<ProfileOptimizerDraft>({});
  const [savedUrl, setSavedUrl] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [activeSection, setActiveSection] = useState<ProfileSectionId | null>(
    null
  );
  const [instruction, setInstruction] = useState("");
  const [threads, setThreads] = useState<
    Partial<Record<ProfileSectionId, RewriteChatTurn[]>>
  >({});
  const [rewriting, setRewriting] = useState(false);
  const [copied, setCopied] = useState(false);
  const saveTimer = useRef<number | null>(null);
  const draftRef = useRef(draft);
  draftRef.current = draft;

  const persist = useCallback(
    (next: ProfileOptimizerDraft) => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(() => {
        void (async () => {
          const result = await saveOptimizerDraft(next, impersonate);
          if (!result.ok) {
            setError(result.error ?? "Could not save draft.");
          }
        })();
      }, SAVE_DEBOUNCE_MS);
    },
    [impersonate]
  );

  function updateDraft(next: ProfileOptimizerDraft) {
    setDraft(next);
    persist(next);
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const result = await getOptimizer(impersonate);
      if (cancelled) return;
      if (!result.ok || !result.data) {
        setError(result.error ?? "Could not load your LinkedIn profile.");
        setLoading(false);
        return;
      }
      setProfile(result.data.profile);
      setDraft(result.data.draft ?? {});
      const url = result.data.savedLinkedinUrl ?? result.data.profile?.linkedinUrl ?? "";
      setSavedUrl(url);
      setUrlInput(url);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
  }, [impersonate]);

  useEffect(() => {
    setInstruction("");
    setCopied(false);
  }, [activeSection]);

  async function handleImport() {
    setError(null);
    setImporting(true);
    const result = await importLinkedInProfile(urlInput || savedUrl, impersonate);
    setImporting(false);
    if (!result.ok || !result.data?.profile) {
      setError(result.error ?? "Could not import LinkedIn profile.");
      return;
    }
    setProfile(result.data.profile);
    setSavedUrl(result.data.profile.linkedinUrl);
    setUrlInput(result.data.profile.linkedinUrl);
  }

  async function handleRewrite() {
    if (!activeSection) return;
    const direction = instruction.trim();
    const section = activeSection;
    setError(null);
    setRewriting(true);
    const result = await rewriteOptimizerSection(
      {
        section,
        instruction: direction || undefined,
        experienceIndex: 0,
      },
      impersonate
    );
    setRewriting(false);
    if (!result.ok || !result.data?.variants?.length) {
      setError(result.error ?? "Could not rewrite that section.");
      return;
    }
    setThreads((prev) => ({
      ...prev,
      [section]: [
        ...(prev[section] ?? []),
        ...(direction ? [{ kind: "user" as const, text: direction }] : []),
        { kind: "assistant" as const, variants: result.data!.variants },
      ],
    }));
    setInstruction("");
    const recommended =
      result.data.variants.find((v) => v.recommended) ?? result.data.variants[0];
    if (recommended) applyVariant(recommended, section);
  }

  function applyVariant(
    variant: ProfileOptimizerVariant,
    section: ProfileSectionId = activeSection ?? "headline"
  ) {
    if (section === "headline") {
      updateDraft({ ...draftRef.current, headline: variant.text });
      return;
    }
    if (section === "about") {
      updateDraft({ ...draftRef.current, about: variant.text });
      return;
    }
    if (section === "banner") {
      updateDraft({ ...draftRef.current, bannerCopy: variant.text });
      return;
    }
    if (section === "featured") {
      updateDraft({ ...draftRef.current, featuredNotes: variant.text });
      return;
    }
    const parsed = parseExperienceVariant(variant.text);
    updateDraft(upsertExperienceDraft(draftRef.current, { index: 0, ...parsed }));
  }

  async function handleCopy() {
    if (!profile || !activeSection) return;
    const text = textForSection(activeSection, profile.snapshot, draftRef.current);
    const ok = await copyTextToClipboard(text);
    if (!ok) {
      setError("Could not copy. Select the text and copy it yourself.");
      return;
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
    const next: ProfileOptimizerDraft = {
      ...draftRef.current,
      copiedAt: {
        ...draftRef.current.copiedAt,
        [activeSection]: new Date().toISOString(),
      },
    };
    updateDraft(next);
  }

  function handleRevert() {
    if (!activeSection) return;
    const next = { ...draftRef.current };
    if (activeSection === "headline") next.headline = null;
    if (activeSection === "about") next.about = null;
    if (activeSection === "banner") next.bannerCopy = null;
    if (activeSection === "featured") next.featuredNotes = null;
    if (activeSection === "experience") {
      next.experiences = (next.experiences ?? []).filter((row) => row.index !== 0);
      if (next.experiences.length === 0) delete next.experiences;
    }
    updateDraft(next);
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <StickyPageHeader
          title="LinkedIn Profile Optimizer"
          tabs={<CoachToolsHubTabs hub="get-clients" />}
          actions={<RewritePromptAdminControl />}
        />
        <p className="px-1 text-sm text-slate-500">Loading your profile…</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <StickyPageHeader
        title="LinkedIn Profile Optimizer"
        description="Edit the profile as it looks on LinkedIn. Click a section, rewrite it, copy it over."
        tabs={<CoachToolsHubTabs hub="get-clients" />}
        actions={<RewritePromptAdminControl />}
        below={
          <Link
            href={`${prefix}/message-generator`}
            className="w-fit text-sm font-medium text-sky-800 hover:text-sky-950"
          >
            ← All tools
          </Link>
        }
      />

      {error ? <ErrorNote>{error}</ErrorNote> : null}

      {!profile ? (
        <div className="mx-auto w-full max-w-xl rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-900">Import your LinkedIn</p>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">
            We’ll pull the public profile so you can rewrite headline, About,
            Featured, experience, and banner copy in place.
          </p>
          <div className="mt-4">
            <TextField
              label="LinkedIn profile URL"
              value={urlInput}
              onChange={setUrlInput}
              placeholder="https://www.linkedin.com/in/…"
            />
          </div>
          <div className="mt-4">
            <PrimaryButton
              onClick={() => void handleImport()}
              loading={importing}
              disabled={importing}
            >
              Import profile
            </PrimaryButton>
          </div>
        </div>
      ) : (
        <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-3 lg:flex-row lg:items-start">
          <div className="mx-auto flex min-w-0 w-full max-w-[760px] flex-col gap-3 lg:mx-0">
          <ProfileProgressStrip
            snapshot={profile.snapshot}
            draft={draft}
            active={activeSection}
            onSelect={setActiveSection}
          />
          <ProfileOptimizerCanvas
            snapshot={profile.snapshot}
            draft={draft}
            activeSection={activeSection}
            onSelect={setActiveSection}
            onHeadline={(headline) =>
              updateDraft({ ...draftRef.current, headline })
            }
            onAbout={(about) => updateDraft({ ...draftRef.current, about })}
            onBannerCopy={(bannerCopy) =>
              updateDraft({ ...draftRef.current, bannerCopy })
            }
            onFeaturedNotes={(featuredNotes) =>
              updateDraft({ ...draftRef.current, featuredNotes })
            }
            onExperience={(patch) =>
              updateDraft(upsertExperienceDraft(draftRef.current, { index: 0, ...patch }))
            }
          />
          {profile.linkedinUrl ? (
            <p className="px-1 text-xs text-slate-500">
              Imported from{" "}
              <a
                href={profile.linkedinUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-sky-800 hover:underline"
              >
                {profile.linkedinUrl}
              </a>
              . Paste drafts into LinkedIn yourself — we don’t write to LinkedIn.
            </p>
          ) : null}
          </div>
          <RewriteCoachPanel
            sectionLabel={
              SECTION_META.find((item) => item.id === activeSection)?.label ??
              null
            }
            instruction={instruction}
            onInstruction={setInstruction}
            onRewrite={() => void handleRewrite()}
            rewriting={rewriting}
            turns={activeSection ? (threads[activeSection] ?? []) : []}
            onPickVariant={(variant) => applyVariant(variant)}
            onCopy={() => void handleCopy()}
            copied={copied}
            onRevert={handleRevert}
            canRevert={sectionHasDraft(activeSection, draft)}
            adminControl={<RewritePromptAdminControl />}
          />
        </div>
      )}
    </div>
  );
}
