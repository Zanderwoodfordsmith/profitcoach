import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  getDoubleProfitsLandingCopy,
  PAM_CALENDAR_EMBED_CODE,
  PAM_DOUBLE_PROFITS_FALLBACK_AVATAR,
} from "@/lib/doubleProfitsLandingCopy";

export type DoubleProfitsCoach = {
  slug: string;
  fullName: string;
  avatarUrl: string | null;
  calendarEmbedCode: string | null;
  copy: ReturnType<typeof getDoubleProfitsLandingCopy>;
};

const DISPLAY_NAMES: Record<string, string> = {
  pam: "Pam Woodford",
};

export async function getDoubleProfitsCoach(
  rawSlug: string
): Promise<DoubleProfitsCoach | null> {
  const slug = rawSlug.trim().toLowerCase() || "pam";

  const { data, error } = await supabaseAdmin
    .from("coaches")
    .select("slug, calendar_embed_code, profiles!inner(full_name, avatar_url)")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    console.error("getDoubleProfitsCoach:", error);
    return null;
  }
  if (!data) return null;

  const row = data as unknown as {
    slug: string;
    calendar_embed_code?: string | null;
    profiles:
      | {
          full_name: string | null;
          avatar_url: string | null;
        }
      | Array<{
          full_name: string | null;
          avatar_url: string | null;
        }>
      | null;
  };

  const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
  const fullName =
    DISPLAY_NAMES[slug] ?? profile?.full_name?.trim() ?? "Pam Woodford";
  const copy = getDoubleProfitsLandingCopy(fullName);

  const avatarUrl =
    profile?.avatar_url?.trim() ||
    (slug === "pam" ? PAM_DOUBLE_PROFITS_FALLBACK_AVATAR : null);

  const calendarEmbedCode =
    row.calendar_embed_code?.trim() ||
    (slug === "pam" ? PAM_CALENDAR_EMBED_CODE : null);

  return {
    slug: row.slug,
    fullName,
    avatarUrl,
    calendarEmbedCode,
    copy,
  };
}
