import "server-only";

import { findPracticeKnowledge } from "@/lib/practiceKnowledge/store";
import type { PracticeKnowledgeRow } from "@/lib/practiceKnowledge/types";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { coachSiteFromBlueprint } from "./fromBlueprint";
import { sitePhotosFor } from "./photos";
import type { CoachSite } from "./types";

type CoachRow = {
  id: string;
  slug: string;
  profiles:
    | {
        full_name: string | null;
        avatar_url: string | null;
        location: string | null;
        latitude: number | null;
        longitude: number | null;
      }
    | Array<{
        full_name: string | null;
        avatar_url: string | null;
        location: string | null;
        latitude: number | null;
        longitude: number | null;
      }>
    | null;
};

/** Slugs are lower-case letters, numbers and hyphens (see coachSlug.ts). */
export function isCoachSlug(raw: string): boolean {
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(raw) && raw.length <= 60;
}

/**
 * The coach's website content, or null when the slug is not a coach.
 * approvedOnly: a live site reads only the sections the coach or BCA signed off.
 */
export async function loadCoachSite(
  rawSlug: string,
  options: { approvedOnly: boolean }
): Promise<CoachSite | null> {
  return (await loadCoachSiteAndRow(rawSlug, options))?.site ?? null;
}

/** The website content plus the Blueprint row it came from, for documents that need more fields. */
export async function loadCoachSiteAndRow(
  rawSlug: string,
  { approvedOnly }: { approvedOnly: boolean }
): Promise<{ site: CoachSite; row: PracticeKnowledgeRow | null } | null> {
  const slug = rawSlug.trim().toLowerCase();
  if (!isCoachSlug(slug)) return null;

  const { data, error } = await supabaseAdmin
    .from("coaches")
    .select("id, slug, profiles!inner(full_name, avatar_url, location, latitude, longitude)")
    .eq("slug", slug)
    .maybeSingle();
  if (error) {
    console.error("loadCoachSite:", error.message);
    return null;
  }
  if (!data) return null;

  const coach = data as unknown as CoachRow;
  const profile = Array.isArray(coach.profiles) ? coach.profiles[0] : coach.profiles;
  const name = profile?.full_name?.trim();
  if (!name) return null;

  const row = await findPracticeKnowledge(coach.id);
  const photos = sitePhotosFor(coach.slug, name);

  const site = coachSiteFromBlueprint({
    slug: coach.slug,
    name,
    avatarUrl: profile?.avatar_url?.trim() || null,
    lat: typeof profile?.latitude === "number" ? profile.latitude : null,
    lng: typeof profile?.longitude === "number" ? profile.longitude : null,
    profileLocation: profile?.location ?? null,
    row,
    photo: photos.portrait,
    stagePhoto: photos.stage,
    approvedOnly,
  });
  return { site, row };
}
