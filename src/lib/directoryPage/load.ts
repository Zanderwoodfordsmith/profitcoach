import "server-only";

import type { LinkedInProfileSnapshot } from "@/lib/apify/linkedinProfileTypes";
import { resolveDirectorySummary } from "@/lib/profileBioFields";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  careerFromLinkedIn,
  firstNameOf,
  parseDirectoryPage,
  socialsFrom,
  type DirectoryCoachView,
} from "./types";

type ProfileRow = {
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  coach_business_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  directory_summary: string | null;
  directory_bio: string | null;
  location: string | null;
  linkedin_url: string | null;
  social_links: unknown;
  directory_page: unknown;
  access_removed_at: string | null;
};

type CoachRow = {
  id: string;
  slug: string;
  directory_listed: boolean | null;
  directory_level: string | null;
  calendar_embed_code: string | null;
  booking_calendar_provider: string | null;
  profiles: ProfileRow | ProfileRow[] | null;
};

export type LoadedDirectoryCoach = { coachId: string; view: DirectoryCoachView };

/** Longer than this, a summary is a bio in disguise and moves into About. */
const HEADLINE_MAX = 260;

/** LinkedIn "bold" letters (𝗙𝗘𝗘𝗟) back to plain text; tidy spacing, keep paragraphs. */
function tidy(raw: string | null | undefined): string {
  return (raw ?? "")
    .normalize("NFKC")
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** `text` minus its first `prefix.length` letters, ignoring spacing differences. */
function dropLeading(text: string, prefix: string): string {
  let left = prefix.replace(/\s/g, "").length;
  let i = 0;
  while (i < text.length && left > 0) {
    if (!/\s/.test(text[i])) left -= 1;
    i += 1;
  }
  return text.slice(i).trim();
}

/**
 * The headline under the name and the About text. A short summary is the
 * headline. A long one is really a bio: it fills About when there is no bio,
 * and is never printed twice.
 */
export function headlineAndAbout(p: Pick<ProfileRow, "directory_summary" | "directory_bio" | "bio">) {
  const summary = tidy(resolveDirectorySummary(p));
  const bio = tidy(p.directory_bio);
  const flat = (s: string) => s.replace(/\s+/g, " ");
  const headline = summary && flat(summary).length <= HEADLINE_MAX ? flat(summary) : "";
  let about = bio || (headline ? "" : summary);
  if (headline && flat(about).startsWith(headline)) about = dropLeading(about, headline);
  return { headline: headline || null, about: about || null, aboutFromSummary: !bio && Boolean(about) };
}

/**
 * A coach's directory page, listed or not. Callers decide who may see an
 * unlisted page (the public page shows only listed coaches).
 */
export async function loadDirectoryCoach(rawSlug: string): Promise<LoadedDirectoryCoach | null> {
  const slug = rawSlug?.trim().toLowerCase();
  if (!slug || !/^[a-z0-9-]{1,60}$/.test(slug)) return null;

  const { data, error } = await supabaseAdmin
    .from("coaches")
    .select(
      `id, slug, directory_listed, directory_level, calendar_embed_code, booking_calendar_provider,
       profiles!inner ( full_name, first_name, last_name, coach_business_name, avatar_url, bio,
         directory_summary, directory_bio, location, linkedin_url, social_links, directory_page, access_removed_at )`
    )
    .eq("slug", slug)
    .maybeSingle();
  if (error) {
    console.error("loadDirectoryCoach:", error.message);
    return null;
  }
  if (!data) return null;

  const coach = data as unknown as CoachRow;
  const p = Array.isArray(coach.profiles) ? coach.profiles[0] : coach.profiles;
  if (!p || p.access_removed_at) return null;

  const name =
    p.full_name?.trim() || [p.first_name, p.last_name].filter(Boolean).join(" ").trim() || coach.slug;
  const extras = parseDirectoryPage(p.directory_page);
  const copy = headlineAndAbout(p);

  const [linkedin, discovery] = await Promise.all([
    extras.career === undefined
      ? supabaseAdmin
          .from("coach_linkedin_profiles")
          .select("snapshot")
          .eq("coach_id", coach.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabaseAdmin
      .from("coach_calendars")
      .select("id")
      .eq("coach_id", coach.id)
      .eq("slug", "discovery")
      .limit(1),
  ]);

  const snapshot = (linkedin.data as { snapshot?: LinkedInProfileSnapshot } | null)?.snapshot;
  const imported = extras.career === undefined ? careerFromLinkedIn(snapshot?.experiences) : [];
  const hasCalendar =
    coach.booking_calendar_provider === "ghl"
      ? Boolean(coach.calendar_embed_code?.trim())
      : (discovery.data?.length ?? 0) > 0;

  return {
    coachId: coach.id,
    view: {
      slug: coach.slug,
      name,
      firstName: p.first_name?.trim() || firstNameOf(name),
      business: p.coach_business_name?.trim() || null,
      avatarUrl: p.avatar_url?.trim() || null,
      summary: copy.headline,
      bio: copy.about,
      aboutFromSummary: copy.aboutFromSummary,
      location: p.location?.trim() || null,
      level: coach.directory_level,
      listed: Boolean(coach.directory_listed),
      linkedinUrl: p.linkedin_url?.trim() || null,
      socials: socialsFrom(p.social_links),
      extras,
      career: extras.career ?? imported,
      careerFromLinkedIn: extras.career === undefined && imported.length > 0,
      hasCalendar,
    },
  };
}
