"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type {
  LinkedInEducation,
  LinkedInExperience,
  LinkedInFeaturedItem,
  LinkedInProfileSnapshot,
} from "@/lib/apify/linkedinProfileTypes";
import {
  experienceDraftAt,
  sectionStatus,
  type SectionStatus,
} from "@/lib/linkedinProfileOptimizer/draft";
import {
  FIELD_LIMITS,
  PROFILE_SECTIONS,
  type ProfileOptimizerDraft,
  type ProfileSectionId,
} from "@/lib/linkedinProfileOptimizer/types";

const COVER_ASPECT = "aspect-[1584/396]";
const FEATURED_SLOTS = ["Newsletter", "Proof", "Lead magnet"] as const;

export const SECTION_META: { id: ProfileSectionId; label: string }[] = [
  { id: "headline", label: "Headline" },
  { id: "about", label: "About" },
  { id: "featured", label: "Featured" },
  { id: "experience", label: "Experience" },
  { id: "banner", label: "Banner" },
];

function statusLabel(status: SectionStatus): string {
  if (status === "draft") return "Draft";
  if (status === "needs-work") return "Needs work";
  return "Live";
}

function StatusChip({ status }: { status: SectionStatus }) {
  const tone =
    status === "draft"
      ? "border-sky-200 bg-sky-50 text-sky-800"
      : status === "needs-work"
        ? "border-amber-200 bg-amber-50 text-amber-800"
        : "border-slate-200 bg-white/90 text-slate-600";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${tone}`}
    >
      {statusLabel(status)}
    </span>
  );
}

function formatConnections(count: number | null): string | null {
  if (count == null) return null;
  if (count >= 500) return "500+ connections";
  return `${count.toLocaleString()} connections`;
}

function dateRange(
  start: string | null,
  end: string | null,
  duration: string | null
): string | null {
  const range =
    start || end ? [start, end ?? "Present"].filter(Boolean).join(" – ") : null;
  if (range && duration) return `${range} · ${duration}`;
  return range ?? duration;
}

function LogoMark({ label }: { label: string }) {
  return (
    <div
      className="flex h-12 w-12 shrink-0 items-center justify-center rounded bg-[#e9e5df] text-base font-semibold text-[#666]"
      aria-hidden
    >
      {(label || "?").slice(0, 1).toUpperCase()}
    </div>
  );
}

function ClampedCopy({
  text,
  limit,
  moreLabel,
  lessLabel,
  onEdit,
  className = "mt-3",
}: {
  text: string;
  limit: number;
  moreLabel: string;
  lessLabel: string;
  onEdit?: () => void;
  className?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const long = text.length > limit;
  const shown = long && !expanded ? `${text.slice(0, limit).trimEnd()}…` : text;
  return (
    <div className={className}>
      <button
        type="button"
        onClick={onEdit}
        className="w-full text-left whitespace-pre-wrap text-[14px] leading-[1.4] text-[#191919]"
      >
        {shown}
      </button>
      {long ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setExpanded((v) => !v);
          }}
          className="text-[14px] font-semibold text-[#666666] hover:text-[#191919] hover:underline"
        >
          {expanded ? lessLabel : moreLabel}
        </button>
      ) : null}
    </div>
  );
}

function AutoTextarea({
  value,
  onChange,
  className,
  maxLength,
  placeholder,
}: {
  value: string;
  onChange: (next: string) => void;
  className?: string;
  maxLength: number;
  placeholder?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      value={value}
      maxLength={maxLength}
      placeholder={placeholder}
      rows={1}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full resize-none bg-transparent outline-none placeholder:text-slate-400 ${className ?? ""}`}
    />
  );
}

function SectionCard({
  sectionId,
  active,
  children,
}: {
  sectionId: ProfileSectionId;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <div
      id={`optimizer-${sectionId}`}
      className={`overflow-hidden rounded-xl border bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.02)] ${
        active ? "border-sky-400 ring-2 ring-sky-200" : "border-[#e0e0e0]"
      }`}
    >
      {children}
    </div>
  );
}

export function ProfileProgressStrip({
  snapshot,
  draft,
  active,
  onSelect,
}: {
  snapshot: LinkedInProfileSnapshot;
  draft: ProfileOptimizerDraft;
  active: ProfileSectionId | null;
  onSelect: (id: ProfileSectionId) => void;
}) {
  const ready = PROFILE_SECTIONS.filter(
    (id) => sectionStatus(id, snapshot, draft) === "draft"
  ).length;

  return (
    <div className="sticky top-[4.5rem] z-10 -mx-1 rounded-xl border border-slate-200/80 bg-white/90 px-2 py-2 shadow-sm backdrop-blur sm:px-3">
      <div className="mb-1.5 flex items-center justify-between px-1">
        <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400">
          Profile
        </p>
        <p className="text-[11px] text-slate-500">
          {ready} of {PROFILE_SECTIONS.length} drafted
        </p>
      </div>
      <div className="flex flex-wrap gap-1">
        {SECTION_META.map((item) => {
          const status = sectionStatus(item.id, snapshot, draft);
          const isActive = active === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onSelect(item.id);
                document
                  .getElementById(`optimizer-${item.id}`)
                  ?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition ${
                isActive
                  ? "bg-sky-600 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {item.label}
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  isActive
                    ? "bg-white"
                    : status === "draft"
                      ? "bg-sky-500"
                      : status === "needs-work"
                        ? "bg-amber-500"
                        : "bg-slate-300"
                }`}
                aria-hidden
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function EducationRow({ edu }: { edu: LinkedInEducation }) {
  const dates = dateRange(edu.start, edu.end, null);
  const degreeLine = [edu.degree, edu.field].filter(Boolean).join(", ");
  return (
    <li className="flex gap-3">
      <LogoMark label={edu.school ?? "?"} />
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-semibold leading-snug text-[#191919]">
          {edu.school ?? "School"}
        </p>
        {degreeLine ? (
          <p className="text-[14px] leading-snug text-[#191919]">{degreeLine}</p>
        ) : null}
        {dates ? (
          <p className="mt-0.5 text-[12px] leading-snug text-[#666666]">{dates}</p>
        ) : null}
      </div>
    </li>
  );
}

export function ProfileOptimizerCanvas({
  snapshot,
  draft,
  activeSection,
  onSelect,
  onHeadline,
  onAbout,
  onBannerCopy,
  onFeaturedNotes,
  onExperience,
}: {
  snapshot: LinkedInProfileSnapshot;
  draft: ProfileOptimizerDraft;
  activeSection: ProfileSectionId | null;
  onSelect: (id: ProfileSectionId) => void;
  onHeadline: (next: string) => void;
  onAbout: (next: string) => void;
  onBannerCopy: (next: string) => void;
  onFeaturedNotes: (next: string) => void;
  onExperience: (patch: { title?: string; description?: string }) => void;
}) {
  const headline = draft.headline ?? snapshot.headline ?? "";
  const about = draft.about ?? snapshot.about ?? "";
  const bannerCopy = draft.bannerCopy ?? "";
  const featuredNotes = draft.featuredNotes ?? "";
  const featuredItems = snapshot.featured ?? [];
  const current = snapshot.experiences[0];
  const expDraft = experienceDraftAt(draft, 0);
  const currentTitle = expDraft?.title ?? current?.title ?? "";
  const currentDescription = expDraft?.description ?? current?.description ?? "";
  const connectionsLabel = formatConnections(snapshot.connectionsCount);
  const currentCompany = snapshot.experiences.find((e) => e.company)?.company;
  const school = snapshot.education[0]?.school;
  const restExperiences = snapshot.experiences.slice(1);

  return (
    <div className="space-y-2 bg-[#f4f2ee] sm:space-y-2.5">
      <div
        id="optimizer-banner"
        className={`overflow-hidden rounded-xl border bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.02)] ${
          activeSection === "headline" || activeSection === "banner"
            ? "border-sky-400 ring-2 ring-sky-200"
            : "border-[#e0e0e0]"
        }`}
      >
        <div className="relative">
          <div
            className={`relative w-full overflow-hidden bg-[#d9d9d9] ${COVER_ASPECT}`}
          >
            {snapshot.bannerUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- remote LinkedIn CDN URL
              <img
                src={snapshot.bannerUrl}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-r from-[#a0b4c8] to-[#7a94ab]" />
            )}
            <button
              type="button"
              onClick={() => onSelect("banner")}
              className={`absolute inset-0 z-[1] ${
                activeSection === "banner" ? "pointer-events-none" : ""
              }`}
              aria-label="Edit banner copy"
            />
            {bannerCopy || activeSection === "banner" ? (
              <div className="pointer-events-none absolute inset-0 z-[2] flex items-center justify-center bg-black/30 px-6">
                {activeSection === "banner" ? (
                  <div className="pointer-events-auto w-full max-w-xl">
                    <AutoTextarea
                      value={bannerCopy}
                      onChange={onBannerCopy}
                      maxLength={FIELD_LIMITS.bannerCopy}
                      placeholder="Who you help + the result — this sits on the banner"
                      className="text-center text-lg font-semibold leading-snug text-white placeholder:text-white/70"
                    />
                  </div>
                ) : (
                  <p className="max-w-xl text-center text-lg font-semibold leading-snug text-white">
                    {bannerCopy}
                  </p>
                )}
              </div>
            ) : null}
            <div className="pointer-events-none absolute right-3 top-3 z-[3]">
              <StatusChip status={sectionStatus("banner", snapshot, draft)} />
            </div>
          </div>
        </div>

        <div
          id="optimizer-headline"
          className="relative px-4 pb-5 pt-0 sm:px-6 sm:pb-6"
        >
          <div className="-mt-[11%] mb-3 w-fit sm:-mt-[9%]">
            {snapshot.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- remote LinkedIn CDN URL
              <img
                src={snapshot.photoUrl}
                alt=""
                className="h-[104px] w-[104px] rounded-full border-[3px] border-white object-cover shadow-sm sm:h-[152px] sm:w-[152px] sm:border-4"
              />
            ) : (
              <div
                className="flex h-[104px] w-[104px] items-center justify-center rounded-full border-[3px] border-white bg-[#e9e5df] text-3xl font-semibold text-[#666] shadow-sm sm:h-[152px] sm:w-[152px] sm:border-4 sm:text-4xl"
                aria-hidden
              >
                {(snapshot.fullName ?? "?").slice(0, 1).toUpperCase()}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-[22px] font-semibold leading-tight tracking-[-0.01em] text-[#191919] sm:text-[24px]">
                  {snapshot.fullName ?? "LinkedIn profile"}
                </h2>
                <button type="button" onClick={() => onSelect("headline")}>
                  <StatusChip
                    status={sectionStatus("headline", snapshot, draft)}
                  />
                </button>
              </div>
              {activeSection === "headline" ? (
                <AutoTextarea
                  value={headline}
                  onChange={onHeadline}
                  maxLength={FIELD_LIMITS.headline}
                  placeholder="Who you help + the outcome"
                  className="mt-1 max-w-[42rem] text-[14px] leading-[1.35] text-[#191919] sm:text-[16px]"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => onSelect("headline")}
                  className="mt-1 max-w-[42rem] text-left text-[14px] leading-[1.35] text-[#191919] sm:text-[16px]"
                >
                  {headline.trim() || (
                    <span className="text-slate-400">
                      Add a headline — who you help + the outcome
                    </span>
                  )}
                </button>
              )}
              {snapshot.location ? (
                <p className="mt-1.5 text-[14px] leading-snug text-[#666666]">
                  {snapshot.location}
                </p>
              ) : null}
              {connectionsLabel ? (
                <p className="mt-1 text-[14px] font-semibold leading-snug text-[#0a66c2]">
                  {connectionsLabel}
                </p>
              ) : snapshot.followerCount != null ? (
                <p className="mt-1 text-[14px] font-semibold leading-snug text-[#0a66c2]">
                  {snapshot.followerCount.toLocaleString()} followers
                </p>
              ) : null}
            </div>

            {(currentCompany || school) && (
              <div className="hidden w-56 shrink-0 space-y-2 sm:block">
                {currentCompany ? (
                  <div className="flex items-center gap-2">
                    <LogoMark label={currentCompany} />
                    <p className="text-[12px] font-semibold leading-snug text-[#191919]">
                      {currentCompany}
                    </p>
                  </div>
                ) : null}
                {school ? (
                  <div className="flex items-center gap-2">
                    <LogoMark label={school} />
                    <p className="text-[12px] font-semibold leading-snug text-[#191919]">
                      {school}
                    </p>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </div>

      <SectionCard
        sectionId="about"
        active={activeSection === "about"}
      >
        <div className="px-4 pb-4 pt-4 sm:px-6 sm:pb-5 sm:pt-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-[16px] font-semibold leading-snug text-[#191919]">
              About
            </h3>
            <button type="button" onClick={() => onSelect("about")}>
              <StatusChip status={sectionStatus("about", snapshot, draft)} />
            </button>
          </div>
          {activeSection === "about" ? (
            <AutoTextarea
              value={about}
              onChange={onAbout}
              maxLength={FIELD_LIMITS.about}
              placeholder="Write to the owner — pain, mechanism, proof, next step"
              className="mt-3 whitespace-pre-wrap text-[14px] leading-[1.4] text-[#191919]"
            />
          ) : about.trim() ? (
            <ClampedCopy
              text={about}
              limit={280}
              moreLabel="more"
              lessLabel="show less"
              onEdit={() => onSelect("about")}
            />
          ) : (
            <button
              type="button"
              onClick={() => onSelect("about")}
              className="mt-3 w-full text-left text-[14px] leading-[1.4] text-slate-400"
            >
              Add an About written to the owner you want to attract.
            </button>
          )}
        </div>
      </SectionCard>

      <SectionCard
        sectionId="featured"
        active={activeSection === "featured"}
      >
        <div className="px-4 pb-4 pt-4 sm:px-6 sm:pb-5 sm:pt-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-[16px] font-semibold leading-snug text-[#191919]">
              Featured
            </h3>
            <button type="button" onClick={() => onSelect("featured")}>
              <StatusChip status={sectionStatus("featured", snapshot, draft)} />
            </button>
          </div>
          <ul className="mt-4 grid grid-cols-3 gap-2">
            {FEATURED_SLOTS.map((slot, i) => (
              <FeaturedCard
                key={slot}
                item={featuredItems[i] ?? null}
                emptyLabel={slot}
                onSelect={() => onSelect("featured")}
              />
            ))}
          </ul>
          {featuredItems.length > 3 ? (
            <p className="mt-2 text-center text-[13px] font-semibold text-[#191919]">
              Show all {featuredItems.length} featured →
            </p>
          ) : null}
          {activeSection === "featured" ? (
            <AutoTextarea
              value={featuredNotes}
              onChange={onFeaturedNotes}
              maxLength={FIELD_LIMITS.featuredNotes}
              placeholder="What to pin, in order — newsletter, proof, lead magnet — and why"
              className="mt-3 whitespace-pre-wrap text-[14px] leading-[1.4] text-[#191919]"
            />
          ) : featuredNotes.trim() ? (
            <button
              type="button"
              onClick={() => onSelect("featured")}
              className="mt-3 w-full text-left whitespace-pre-wrap text-[14px] leading-[1.4] text-[#191919]"
            >
              {featuredNotes}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onSelect("featured")}
              className="mt-3 w-full text-left text-[14px] leading-[1.4] text-slate-400"
            >
              {featuredItems.length > 0
                ? "Rewrite to get pin advice — keep, replace, or reorder these."
                : "Rewrite for what to pin in these three slots."}
            </button>
          )}
        </div>
      </SectionCard>

      <SectionCard
        sectionId="experience"
        active={activeSection === "experience"}
      >
        <div className="px-4 pb-4 pt-4 sm:px-6 sm:pb-5 sm:pt-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-[16px] font-semibold leading-snug text-[#191919]">
              Experience
            </h3>
            <button type="button" onClick={() => onSelect("experience")}>
              <StatusChip status={sectionStatus("experience", snapshot, draft)} />
            </button>
          </div>
          <div className="mt-4 flex gap-3">
            <LogoMark label={current?.company ?? currentTitle ?? "?"} />
            <div className="min-w-0 flex-1">
              {activeSection === "experience" ? (
                <AutoTextarea
                  value={currentTitle}
                  onChange={(next) =>
                    onExperience({ title: next, description: currentDescription })
                  }
                  maxLength={FIELD_LIMITS.experienceTitle}
                  placeholder="Current role title"
                  className="text-[14px] font-semibold leading-snug text-[#191919]"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => onSelect("experience")}
                  className="text-left text-[14px] font-semibold leading-snug text-[#191919]"
                >
                  {currentTitle.trim() || "Current role"}
                </button>
              )}
              {current?.company ? (
                <p className="text-[14px] leading-snug text-[#191919]">
                  {[current.company, current.employmentType]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              ) : null}
              {current ? (
                <p className="mt-0.5 text-[12px] leading-snug text-[#666666]">
                  {dateRange(current.start, current.end, current.duration)}
                </p>
              ) : null}
              {activeSection === "experience" ? (
                <AutoTextarea
                  value={currentDescription}
                  onChange={(next) =>
                    onExperience({ title: currentTitle, description: next })
                  }
                  maxLength={FIELD_LIMITS.experienceDescription}
                  placeholder="Frame this role as client outcomes, not a job history"
                  className="mt-1.5 whitespace-pre-wrap text-[14px] leading-snug text-[#191919]"
                />
              ) : currentDescription.trim() ? (
                <ClampedCopy
                  text={currentDescription}
                  limit={220}
                  moreLabel="… more"
                  lessLabel="show less"
                  onEdit={() => onSelect("experience")}
                  className="mt-1.5"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => onSelect("experience")}
                  className="mt-1.5 w-full text-left text-[14px] leading-snug text-slate-400"
                >
                  Rewrite this role around the outcome you help owners get.
                </button>
              )}
            </div>
          </div>
          {restExperiences.length > 0 ? (
            <ul className="mt-4 divide-y divide-[#e0e0e0] border-t border-[#e0e0e0] pt-4">
              {restExperiences.map((exp, i) => (
                <PastRole key={`${exp.title ?? ""}-${exp.start ?? ""}-${i}`} exp={exp} />
              ))}
            </ul>
          ) : null}
        </div>
      </SectionCard>

      {snapshot.education.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-[#e0e0e0] bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.02)]">
          <div className="px-4 py-4 sm:px-6 sm:py-5">
            <h3 className="text-[16px] font-semibold leading-snug text-[#191919]">
              Education
            </h3>
            <ul className="mt-4 space-y-5">
              {snapshot.education.map((edu, i) => (
                <EducationRow key={`${edu.school ?? ""}-${i}`} edu={edu} />
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function FeaturedCard({
  item,
  emptyLabel,
  onSelect,
}: {
  item: LinkedInFeaturedItem | null;
  emptyLabel: string;
  onSelect: () => void;
}) {
  const className =
    "flex min-w-0 flex-col overflow-hidden rounded-lg border border-[#e0e0e0] bg-white text-left";

  if (!item) {
    return (
      <li className="min-w-0">
        <button type="button" onClick={onSelect} className={`${className} w-full`}>
          <div className="aspect-[16/9] w-full bg-[#e9e5df]" />
          <div className="px-2.5 py-2 sm:px-3 sm:py-2.5">
            <p className="text-[12px] font-semibold leading-snug text-[#191919] sm:text-[13px]">
              {emptyLabel}
            </p>
            <p className="mt-0.5 text-[11px] leading-snug text-[#666666] sm:text-[12px]">
              Pin this
            </p>
          </div>
        </button>
      </li>
    );
  }

  const label = item.title || item.subtitle || emptyLabel;
  const inner = (
    <>
      <div className="aspect-[16/9] w-full overflow-hidden bg-[#e9e5df]">
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- remote LinkedIn CDN URL
          <img src={item.imageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-xl font-semibold text-[#666] sm:text-2xl">
            {label.slice(0, 1).toUpperCase()}
          </div>
        )}
      </div>
      <div className="px-2.5 py-2 sm:px-3 sm:py-2.5">
        <p className="line-clamp-2 text-[12px] font-semibold leading-snug text-[#191919] sm:text-[13px]">
          {item.title || emptyLabel}
        </p>
        {item.subtitle ? (
          <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-[#666666] sm:text-[12px]">
            {item.subtitle}
          </p>
        ) : null}
      </div>
    </>
  );

  return (
    <li className="min-w-0">
      {item.url ? (
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className={`${className} hover:border-[#cfcfcf]`}
        >
          {inner}
        </a>
      ) : (
        <button type="button" onClick={onSelect} className={`${className} w-full`}>
          {inner}
        </button>
      )}
    </li>
  );
}

function PastRole({ exp }: { exp: LinkedInExperience }) {
  const dates = dateRange(exp.start, exp.end, exp.duration);
  const companyLine = [exp.company, exp.employmentType].filter(Boolean).join(" · ");
  return (
    <li className="flex gap-3 py-4 first:pt-0 last:pb-0">
      <LogoMark label={exp.company ?? exp.title ?? "?"} />
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-semibold leading-snug text-[#191919]">
          {exp.title ?? "Role"}
        </p>
        {companyLine ? (
          <p className="text-[14px] leading-snug text-[#191919]">{companyLine}</p>
        ) : null}
        {dates ? (
          <p className="mt-0.5 text-[12px] leading-snug text-[#666666]">{dates}</p>
        ) : null}
        {exp.description ? (
          <ClampedCopy
            text={exp.description}
            limit={220}
            moreLabel="… more"
            lessLabel="show less"
            className="mt-1.5"
          />
        ) : null}
      </div>
    </li>
  );
}
