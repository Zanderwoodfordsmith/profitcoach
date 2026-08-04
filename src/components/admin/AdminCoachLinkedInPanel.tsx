"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ExternalLink, Loader2, RefreshCw } from "lucide-react";

import type {
  LinkedInEducation,
  LinkedInExperience,
  LinkedInProfileSnapshot,
} from "@/lib/apify/linkedinProfileTypes";
import { formatDateDisplay } from "@/lib/formatDateDisplay";
import { supabaseClient } from "@/lib/supabaseClient";

export type AdminCoachLinkedInProfile = {
  linkedin_url: string;
  scraped_at: string;
  snapshot: LinkedInProfileSnapshot;
};

type Props = {
  coachId: string;
  linkedinUrl: string | null;
  initialProfile: AdminCoachLinkedInProfile | null;
  onProfileChange?: (profile: AdminCoachLinkedInProfile) => void;
};

/** LinkedIn cover is 1584×396 (4:1). */
const COVER_ASPECT = "aspect-[1584/396]";

function formatScrapedAt(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso;
  return formatDateDisplay(new Date(t));
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

function companyKey(company: string | null): string {
  return (company ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

type ExperienceGroup = {
  company: string | null;
  roles: LinkedInExperience[];
};

/** Group consecutive roles at the same company (LinkedIn order). */
function groupExperiences(experiences: LinkedInExperience[]): ExperienceGroup[] {
  const groups: ExperienceGroup[] = [];
  for (const exp of experiences) {
    const prev = groups[groups.length - 1];
    const key = companyKey(exp.company);
    const prevKey = prev ? companyKey(prev.company) : "";
    const sameGroupId =
      Boolean(exp.experienceGroupId) &&
      Boolean(prev?.roles[0]?.experienceGroupId) &&
      exp.experienceGroupId === prev!.roles[0]!.experienceGroupId;
    const sameCompany = Boolean(key) && key === prevKey;

    if (prev && (sameGroupId || sameCompany)) {
      prev.roles.push(exp);
    } else {
      groups.push({ company: exp.company, roles: [exp] });
    }
  }
  return groups;
}

/** Prefer the longest tenure string in the group (usually earliest → Present). */
function companyTenure(roles: LinkedInExperience[]): string | null {
  const withDuration = roles.filter((r) => r.duration);
  if (withDuration.length > 0) {
    // Heuristic: longest duration string often matches company total on LinkedIn.
    return [...withDuration].sort(
      (a, b) => (b.duration?.length ?? 0) - (a.duration?.length ?? 0)
    )[0]!.duration;
  }
  const starts = roles.map((r) => r.start).filter(Boolean) as string[];
  const ends = roles.map((r) => r.end).filter(Boolean) as string[];
  if (starts.length === 0 && ends.length === 0) return null;
  return [starts[starts.length - 1] ?? starts[0], ends[0] ?? "Present"]
    .filter(Boolean)
    .join(" – ");
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

function ProfileCard({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-[#e0e0e0] bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.02)]">
      {children}
    </div>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h3 className="text-[16px] font-semibold leading-snug text-[#191919]">
      {children}
    </h3>
  );
}

function RoleDescription({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const long = text.length > 220;
  const shown = long && !expanded ? `${text.slice(0, 220).trimEnd()}…` : text;
  return (
    <div className="mt-1.5">
      <p className="whitespace-pre-wrap text-[14px] leading-snug text-[#191919]">
        {shown}
      </p>
      {long ? (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-[14px] font-semibold text-[#666666] hover:text-[#191919] hover:underline"
        >
          {expanded ? "show less" : "… more"}
        </button>
      ) : null}
    </div>
  );
}

function RoleSkills({ skills }: { skills: string[] }) {
  if (skills.length === 0) return null;
  const head = skills.slice(0, 2);
  const rest = skills.length - head.length;
  return (
    <p className="mt-2 flex items-start gap-1.5 text-[14px] leading-snug text-[#191919]">
      <span className="mt-0.5 inline-block text-[10px]" aria-hidden>
        ◆
      </span>
      <span>
        <span className="font-semibold">{head.join(", ")}</span>
        {rest > 0 ? ` and +${rest} skills` : ""}
      </span>
    </p>
  );
}

function SingleExperienceRow({ exp }: { exp: LinkedInExperience }) {
  const dates = dateRange(exp.start, exp.end, exp.duration);
  const companyLine = [exp.company, exp.employmentType].filter(Boolean).join(" · ");
  const locationLine = [exp.location, exp.workplaceType]
    .filter(Boolean)
    .join(" · ");
  return (
    <div className="flex gap-3">
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
        {locationLine ? (
          <p className="text-[12px] leading-snug text-[#666666]">{locationLine}</p>
        ) : null}
        {exp.description ? <RoleDescription text={exp.description} /> : null}
        <RoleSkills skills={exp.skills ?? []} />
      </div>
    </div>
  );
}

function GroupedCompanyExperience({ group }: { group: ExperienceGroup }) {
  const company = group.company ?? "Company";
  const tenure = companyTenure(group.roles);
  const headerLocation = [group.roles[0]?.location, group.roles[0]?.workplaceType]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex gap-3">
      <LogoMark label={company} />
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-semibold leading-snug text-[#191919]">
          {company}
        </p>
        {tenure ? (
          <p className="text-[12px] leading-snug text-[#666666]">{tenure}</p>
        ) : null}
        {headerLocation ? (
          <p className="text-[12px] leading-snug text-[#666666]">{headerLocation}</p>
        ) : null}

        <ul className="relative mt-3 space-y-4 border-l border-[#e0e0e0] pl-4">
          {group.roles.map((exp, i) => {
            const dates = dateRange(exp.start, exp.end, exp.duration);
            return (
              <li key={`${exp.title ?? ""}-${exp.start ?? ""}-${i}`} className="relative">
                <span
                  className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-[#b2b2b2]"
                  aria-hidden
                />
                <p className="text-[14px] font-semibold leading-snug text-[#191919]">
                  {exp.title ?? "Role"}
                </p>
                {exp.employmentType ? (
                  <p className="text-[14px] leading-snug text-[#666666]">
                    {exp.employmentType}
                  </p>
                ) : null}
                {dates ? (
                  <p className="mt-0.5 text-[12px] leading-snug text-[#666666]">
                    {dates}
                  </p>
                ) : null}
                {exp.description ? <RoleDescription text={exp.description} /> : null}
                <RoleSkills skills={exp.skills ?? []} />
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function ExperienceList({ experiences }: { experiences: LinkedInExperience[] }) {
  const groups = groupExperiences(experiences);
  return (
    <ul className="mt-4 divide-y divide-[#e0e0e0]">
      {groups.map((group, i) => (
        <li key={`${group.company ?? "co"}-${i}`} className="py-4 first:pt-0 last:pb-0">
          {group.roles.length > 1 ? (
            <GroupedCompanyExperience group={group} />
          ) : (
            <SingleExperienceRow exp={group.roles[0]!} />
          )}
        </li>
      ))}
    </ul>
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

function LinkedInSnapshotView({ snapshot }: { snapshot: LinkedInProfileSnapshot }) {
  const [aboutExpanded, setAboutExpanded] = useState(false);
  const aboutLong = (snapshot.about?.length ?? 0) > 280;
  const aboutText =
    aboutLong && !aboutExpanded
      ? `${snapshot.about!.slice(0, 280).trimEnd()}…`
      : snapshot.about;

  const connectionsLabel = formatConnections(snapshot.connectionsCount);
  const currentCompany = snapshot.experiences.find((e) => e.company)?.company;
  const school = snapshot.education[0]?.school;

  return (
    <div className="space-y-2 bg-[#f4f2ee] sm:space-y-2.5">
      {/* Intro card — cover + identity, LinkedIn layout */}
      <ProfileCard>
        <div className={`relative w-full overflow-hidden bg-[#d9d9d9] ${COVER_ASPECT}`}>
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
        </div>

        <div className="relative px-4 pb-5 pt-0 sm:px-6 sm:pb-6">
          {/* Photo overlaps the cover at ~50%, then name sits below — not beside */}
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
              <h2 className="text-[22px] font-semibold leading-tight tracking-[-0.01em] text-[#191919] sm:text-[24px]">
                {snapshot.fullName ?? "LinkedIn profile"}
              </h2>
              {snapshot.headline ? (
                <p className="mt-1 max-w-[42rem] text-[14px] leading-[1.35] text-[#191919] sm:text-[16px]">
                  {snapshot.headline}
                </p>
              ) : null}
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
      </ProfileCard>

      {snapshot.about ? (
        <ProfileCard>
          <div className="px-4 py-4 sm:px-6 sm:py-5">
            <SectionTitle>About</SectionTitle>
            <p className="mt-3 whitespace-pre-wrap text-[14px] leading-[1.4] text-[#191919]">
              {aboutText}
            </p>
            {aboutLong ? (
              <button
                type="button"
                onClick={() => setAboutExpanded((v) => !v)}
                className="mt-1 text-[14px] font-semibold text-[#666666] hover:text-[#191919] hover:underline"
              >
                {aboutExpanded ? "show less" : "more"}
              </button>
            ) : null}

            {snapshot.skills.length > 0 ? (
              <div className="mt-4 rounded-lg border border-[#e0e0e0] px-3 py-3">
                <p className="text-[14px] font-semibold text-[#191919]">Top skills</p>
                <p className="mt-1 text-[14px] leading-snug text-[#191919]">
                  {snapshot.skills.slice(0, 5).join(" · ")}
                  {snapshot.skills.length > 5
                    ? ` · +${snapshot.skills.length - 5}`
                    : ""}
                </p>
              </div>
            ) : null}
          </div>
        </ProfileCard>
      ) : snapshot.skills.length > 0 ? (
        <ProfileCard>
          <div className="px-4 py-4 sm:px-6 sm:py-5">
            <SectionTitle>Skills</SectionTitle>
            <p className="mt-3 text-[14px] leading-snug text-[#191919]">
              {snapshot.skills.slice(0, 12).join(" · ")}
              {snapshot.skills.length > 12
                ? ` · +${snapshot.skills.length - 12} more`
                : ""}
            </p>
          </div>
        </ProfileCard>
      ) : null}

      {snapshot.experiences.length > 0 ? (
        <ProfileCard>
          <div className="px-4 py-4 sm:px-6 sm:py-5">
            <SectionTitle>Experience</SectionTitle>
            <ExperienceList experiences={snapshot.experiences} />
            {snapshot.experiences.length > 12 ? (
              <p className="mt-2 text-center text-[14px] font-semibold text-[#191919]">
                Show all {snapshot.experiences.length} experiences →
              </p>
            ) : null}
          </div>
        </ProfileCard>
      ) : null}

      {snapshot.education.length > 0 ? (
        <ProfileCard>
          <div className="px-4 py-4 sm:px-6 sm:py-5">
            <SectionTitle>Education</SectionTitle>
            <ul className="mt-4 space-y-5">
              {snapshot.education.map((edu, i) => (
                <EducationRow key={`${edu.school ?? ""}-${i}`} edu={edu} />
              ))}
            </ul>
          </div>
        </ProfileCard>
      ) : null}
    </div>
  );
}

export function AdminCoachLinkedInPanel({
  coachId,
  linkedinUrl,
  initialProfile,
  onProfileChange,
}: Props) {
  const [profile, setProfile] = useState<AdminCoachLinkedInProfile | null>(
    initialProfile
  );
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setProfile(initialProfile);
    setError(null);
  }, [coachId, initialProfile]);

  const snapshot = profile?.snapshot ?? null;
  const canImport = Boolean(linkedinUrl?.trim() || profile?.linkedin_url);

  async function handleRefresh(force: boolean) {
    setError(null);
    setImporting(true);
    try {
      const {
        data: { session },
      } = await supabaseClient.auth.getSession();
      if (!session?.access_token) {
        setError("Not signed in.");
        return;
      }

      const res = await fetch("/api/coach/linkedin/profile", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
          "x-impersonate-coach-id": coachId,
        },
        body: JSON.stringify({
          linkedinUrl: linkedinUrl?.trim() || undefined,
          force,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        profile?: {
          linkedinUrl: string;
          scrapedAt: string;
          snapshot: LinkedInProfileSnapshot;
        } | null;
      };

      if (body.profile) {
        const next: AdminCoachLinkedInProfile = {
          linkedin_url: body.profile.linkedinUrl,
          scraped_at: body.profile.scrapedAt,
          snapshot: body.profile.snapshot,
        };
        setProfile(next);
        onProfileChange?.(next);
      }

      if (!res.ok) {
        setError(body.error ?? "Could not import LinkedIn profile.");
        return;
      }
    } catch {
      setError("Could not import LinkedIn profile.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm sm:p-6">
        <div>
          <h2 className="text-xl font-bold tracking-[-0.02em] text-slate-900 md:text-2xl">
            LinkedIn profile
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">
            Scraped snapshot for admin review. Force refresh bypasses the coach
            cooldown.
          </p>
          {profile?.scraped_at ? (
            <p className="mt-2 text-xs text-slate-500">
              Last scraped {formatScrapedAt(profile.scraped_at)} (
              {new Date(profile.scraped_at).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
              )
            </p>
          ) : linkedinUrl ? (
            <p className="mt-2 text-xs text-amber-700">
              URL set, but not scraped yet.
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {linkedinUrl || profile?.linkedin_url ? (
            <a
              href={linkedinUrl || profile?.linkedin_url || "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              Open profile
              <ExternalLink className="h-4 w-4" aria-hidden />
            </a>
          ) : null}
          <button
            type="button"
            disabled={!canImport || importing}
            onClick={() => void handleRefresh(Boolean(profile))}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {importing ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <RefreshCw className="h-4 w-4" aria-hidden />
            )}
            {importing
              ? "Importing…"
              : profile
                ? "Force refresh"
                : "Import from LinkedIn"}
          </button>
        </div>
      </div>

      {!linkedinUrl && !profile ? (
        <p className="text-sm text-slate-500">
          No LinkedIn URL on this coach yet. Set one from the coaches list, then
          import.
        </p>
      ) : null}

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      {snapshot ? <LinkedInSnapshotView snapshot={snapshot} /> : null}
    </section>
  );
}
