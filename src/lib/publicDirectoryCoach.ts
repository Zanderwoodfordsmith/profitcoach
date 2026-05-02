import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type PublicDirectoryCoach = {
  slug: string;
  directory_level: string | null;
  full_name: string | null;
  coach_business_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  location: string | null;
  linkedin_url: string | null;
};

export async function getPublicDirectoryCoachBySlug(
  rawSlug: string
): Promise<PublicDirectoryCoach | null> {
  const slug = rawSlug?.trim();
  if (!slug) return null;

  const { data, error } = await supabaseAdmin
    .from("coaches")
    .select(
      `slug, directory_level, profiles!inner ( full_name, coach_business_name, avatar_url, bio, location, linkedin_url )`
    )
    .eq("slug", slug)
    .eq("directory_listed", true)
    .maybeSingle();

  if (error) {
    console.error("getPublicDirectoryCoachBySlug:", error);
    return null;
  }
  if (!data) return null;

  const raw = data as unknown as {
    slug: string;
    directory_level: string | null;
    profiles:
      | {
          full_name: string | null;
          coach_business_name: string | null;
          avatar_url: string | null;
          bio: string | null;
          location: string | null;
          linkedin_url: string | null;
        }
      | Array<{
          full_name: string | null;
          coach_business_name: string | null;
          avatar_url: string | null;
          bio: string | null;
          location: string | null;
          linkedin_url: string | null;
        }>
      | null;
  };

  const p = Array.isArray(raw.profiles) ? raw.profiles[0] : raw.profiles;
  if (!p) return null;

  return {
    slug: raw.slug,
    directory_level: raw.directory_level ?? null,
    full_name: p.full_name ?? null,
    coach_business_name: p.coach_business_name ?? null,
    avatar_url: p.avatar_url ?? null,
    bio: p.bio ?? null,
    location: p.location ?? null,
    linkedin_url: p.linkedin_url ?? null,
  };
}
