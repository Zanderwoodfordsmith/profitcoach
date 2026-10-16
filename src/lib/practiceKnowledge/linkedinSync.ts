import { normalizeLinkedInProfileUrl } from "@/lib/linkedin/normalizeProfileUrl";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/** One LinkedIn address for the coach, so Settings and the blueprint compare equal. */
export function coachLinkedInUrl(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim() ?? "";
  if (!trimmed) return null;
  return normalizeLinkedInProfileUrl(trimmed) ?? trimmed;
}

export function sameCoachLinkedInUrl(
  a: string | null | undefined,
  b: string | null | undefined
): boolean {
  return coachLinkedInUrl(a) === coachLinkedInUrl(b);
}

/** Copy a LinkedIn URL onto the account profile. Skips the write when it already matches. */
export async function mirrorLinkedInUrlToProfile(
  coachId: string,
  url: string | null
): Promise<void> {
  const canonical = coachLinkedInUrl(url);
  const { data, error: readError } = await supabaseAdmin
    .from("profiles")
    .select("linkedin_url")
    .eq("id", coachId)
    .maybeSingle();
  if (readError) throw new Error(readError.message);
  const current = (data?.linkedin_url as string | null | undefined) ?? null;
  if (sameCoachLinkedInUrl(current, canonical)) return;
  const { error } = await supabaseAdmin
    .from("profiles")
    .update({ linkedin_url: canonical })
    .eq("id", coachId);
  if (error) throw new Error(error.message);
}
